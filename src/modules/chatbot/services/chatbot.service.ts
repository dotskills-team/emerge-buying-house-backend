import type { QueryFilter } from 'mongoose';
import type { PublicUser } from '../../../core/auth/types/index.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import { escapeRegExp } from '../../../utils/regex.js';
import { ChatAnswerModel, type IChatAnswer } from '../models/chat-answer.model.js';
import {
  UnansweredQuestionModel,
  type UnansweredStatus,
} from '../models/unanswered-question.model.js';
import { findAnswer, indexAnswer, tokenize, type IndexedAnswer } from '../utils/matcher.js';
import { SEED_ANSWERS } from '../seed-answers.js';
import type {
  AskInput,
  CreateAnswerInput,
  UpdateAnswerInput,
} from '../validators/chatbot.validator.js';

/**
 * Published answers, indexed for matching, are kept in memory for a minute. Changes made on this
 * server instance clear it at once; other instances (e.g. on Vercel) catch up within the minute.
 */
const CACHE_MS = 60_000;
let cache: { at: number; answers: IndexedAnswer[] } | null = null;
const clearCache = () => {
  cache = null;
};

async function publishedIndex(): Promise<IndexedAnswer[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.answers;
  const docs = await ChatAnswerModel.find({ published: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .select('question answer keywords')
    .lean();
  const answers = docs.map((d) =>
    indexAnswer({
      id: String(d._id),
      question: d.question,
      answer: d.answer,
      keywords: d.keywords,
    }),
  );
  cache = { at: Date.now(), answers };
  return answers;
}

const brief = (a: { id: string; question: string }) => ({ id: a.id, question: a.question });
const notFound = (what = 'answer') =>
  new HttpError(404, `This ${what} no longer exists.`, 'NOT_FOUND');

/** Counts a question with no answer, grouping questions with the same meaningful words. */
async function recordUnanswered(text: string) {
  const words = tokenize(text);
  if (words.length === 0) return; // "hi", "?" and the like
  const key = [...words].sort().join(' ').slice(0, 600);
  const update = {
    $set: { text: text.slice(0, 500), lastAskedAt: new Date() },
    $inc: { count: 1 },
    $setOnInsert: { status: 'open' as UnansweredStatus, answer: null },
  };
  try {
    const doc = await UnansweredQuestionModel.findOneAndUpdate({ key }, update, {
      upsert: true,
      returnDocument: 'after',
    });
    // Asked again after an answer was written: that answer does not catch it, so reopen.
    if (doc?.status === 'resolved') {
      await UnansweredQuestionModel.updateOne({ _id: doc._id }, { $set: { status: 'open' } });
    }
  } catch (err) {
    // Two first-time askers at once: the other insert won, so count on it.
    if ((err as { code?: unknown }).code === 11000) {
      await UnansweredQuestionModel.updateOne({ key }, { $set: update.$set, $inc: update.$inc });
      return;
    }
    throw err;
  }
}

export const chatbotService = {
  /** The questions offered when the chat opens. */
  async suggestions() {
    const answers = await publishedIndex();
    return { suggestions: answers.slice(0, 4).map(brief) };
  },

  async ask(input: AskInput) {
    if ('answerId' in input) {
      const doc = await ChatAnswerModel.findOneAndUpdate(
        { _id: input.answerId, published: true },
        { $inc: { hits: 1 } },
      ).lean();
      if (!doc) throw notFound();
      return {
        found: true as const,
        answer: { id: String(doc._id), question: doc.question, answer: doc.answer },
        related: [],
      };
    }

    const result = findAnswer(input.message, await publishedIndex());
    if (result.best) {
      const { answer } = result.best;
      await ChatAnswerModel.updateOne({ _id: answer.id }, { $inc: { hits: 1 } });
      return {
        found: true as const,
        answer: { id: answer.id, question: answer.question, answer: answer.answer },
        related: result.suggestions.map(brief),
      };
    }
    await recordUnanswered(input.message);
    return { found: false as const, suggestions: result.suggestions.map(brief) };
  },

  async feedback(id: string, helpful: boolean) {
    const res = await ChatAnswerModel.updateOne(
      { _id: id, published: true },
      { $inc: helpful ? { helpful: 1 } : { notHelpful: 1 } },
    );
    if (res.matchedCount === 0) throw notFound();
  },

  /* ---------- Dashboard ---------- */

  async list(q?: string) {
    const filter: QueryFilter<IChatAnswer> = {};
    if (q) {
      const rx = new RegExp(escapeRegExp(q), 'i');
      filter.$or = [{ question: rx }, { answer: rx }, { keywords: rx }];
    }
    const docs = await ChatAnswerModel.find(filter)
      .sort({ sortOrder: 1, createdAt: 1 })
      .populate('updatedBy', 'name')
      .exec();
    return docs.map((d) => d.toJSON());
  },

  async stats() {
    const [answers, unanswered] = await Promise.all([
      ChatAnswerModel.aggregate<{
        _id: boolean;
        count: number;
        hits: number;
        helpful: number;
        notHelpful: number;
      }>([
        {
          $group: {
            _id: '$published',
            count: { $sum: 1 },
            hits: { $sum: '$hits' },
            helpful: { $sum: '$helpful' },
            notHelpful: { $sum: '$notHelpful' },
          },
        },
      ]),
      UnansweredQuestionModel.aggregate<{ _id: UnansweredStatus; count: number; asked: number }>([
        { $group: { _id: '$status', count: { $sum: 1 }, asked: { $sum: '$count' } } },
      ]),
    ]);
    const sum = <T>(rows: T[], pick: (r: T) => number) => rows.reduce((s, r) => s + pick(r), 0);
    const answered = sum(answers, (r) => r.hits);
    const missed = sum(unanswered, (r) => r.asked);
    return {
      published: answers.find((r) => r._id)?.count ?? 0,
      drafts: answers.find((r) => !r._id)?.count ?? 0,
      answered,
      missed,
      openQuestions: unanswered.find((r) => r._id === 'open')?.count ?? 0,
      helpful: sum(answers, (r) => r.helpful),
      notHelpful: sum(answers, (r) => r.notHelpful),
    };
  },

  async create(user: PublicUser, { fromUnanswered, ...input }: CreateAnswerInput) {
    const doc = await ChatAnswerModel.create({ ...input, createdBy: user.id, updatedBy: user.id });
    if (fromUnanswered) {
      await UnansweredQuestionModel.updateOne(
        { _id: fromUnanswered },
        { $set: { status: 'resolved', answer: doc._id } },
      );
    }
    clearCache();
    return (await doc.populate('updatedBy', 'name')).toJSON();
  },

  async update(user: PublicUser, id: string, input: UpdateAnswerInput) {
    const doc = await ChatAnswerModel.findById(id);
    if (!doc) throw notFound();
    Object.assign(doc, input, { updatedBy: user.id });
    await doc.save();
    clearCache();
    return (await doc.populate('updatedBy', 'name')).toJSON();
  },

  async remove(id: string) {
    const { deletedCount } = await ChatAnswerModel.deleteOne({ _id: id });
    if (deletedCount === 0) throw notFound();
    // Questions it resolved come back to the list, as nothing answers them now.
    await UnansweredQuestionModel.updateMany(
      { answer: id },
      { $set: { status: 'open', answer: null } },
    );
    clearCache();
  },

  async unanswered(status: UnansweredStatus) {
    const docs = await UnansweredQuestionModel.find({ status })
      .sort({ count: -1, lastAskedAt: -1 })
      .limit(200)
      .exec();
    return docs.map((d) => d.toJSON());
  },

  async setUnansweredStatus(id: string, status: 'open' | 'dismissed') {
    const doc = await UnansweredQuestionModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { returnDocument: 'after' },
    );
    if (!doc) throw notFound('question');
    return doc.toJSON();
  },

  /** What a visitor would get for a question, with the match score: for checking wording. */
  async test(message: string) {
    const result = findAnswer(message, await publishedIndex());
    return {
      best: result.best
        ? { ...brief(result.best.answer), score: Math.round(result.best.score * 100) / 100 }
        : null,
      suggestions: result.suggestions.map(brief),
    };
  },
};

/** For tests: forget cached answers. */
export const resetChatbotCache = clearCache;

/**
 * Adds the starter answers that are not there yet, published, in their listed order. An answer
 * whose question already exists (edited or not) is left alone, so running it again is safe.
 */
export async function seedChatbotAnswers(authorId: string) {
  const existing = new Set(
    (await ChatAnswerModel.find().select('question').lean()).map((a) =>
      a.question.trim().toLowerCase(),
    ),
  );
  let created = 0;
  for (const [i, seed] of SEED_ANSWERS.entries()) {
    if (existing.has(seed.question.trim().toLowerCase())) continue;
    await ChatAnswerModel.create({
      question: seed.question,
      answer: seed.answer,
      keywords: seed.keywords,
      published: true,
      sortOrder: i * 10,
      createdBy: authorId,
      updatedBy: authorId,
    });
    created += 1;
  }
  clearCache();
  return { created, skipped: SEED_ANSWERS.length - created };
}
