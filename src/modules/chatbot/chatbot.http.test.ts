import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { startIntegration, type Integration } from '../../test/integration.js';
import { resetChatbotCache } from './services/chatbot.service.js';

let api: Integration;
before(async () => {
  api = await startIntegration();
});
beforeEach(() => resetChatbotCache());
after(async () => {
  await api.stop();
});

interface AnswerView {
  id: string;
  question: string;
  published: boolean;
  hits: number;
  helpful: number;
  keywords: string[];
}
interface AskView {
  found: boolean;
  answer?: { id: string; question: string; answer: string };
  suggestions?: { id: string; question: string }[];
}
interface QuestionView {
  id: string;
  text: string;
  count: number;
  status: string;
}

const ask = (message: string) =>
  api.call<AskView>('/api/chatbot/ask', { method: 'POST', body: { message } });

describe('chatbot', () => {
  it('lets only chatbot managers edit answers', async () => {
    for (const role of ['viewer', 'author'] as const) {
      const u = await api.signIn(role);
      assert.equal((await api.call('/api/chatbot/admin/answers', { token: u.token })).status, 403);
    }
    for (const role of ['admin', 'content_manager'] as const) {
      const u = await api.signIn(role);
      assert.equal((await api.call('/api/chatbot/admin/answers', { token: u.token })).status, 200);
    }
    assert.equal((await api.call('/api/chatbot/admin/answers')).status, 401);
  });

  it('answers with published answers only, and learns what it could not answer', async () => {
    const editor = await api.signIn('content_manager');
    const create = (body: Record<string, unknown>) =>
      api.call<AnswerView>('/api/chatbot/admin/answers', {
        method: 'POST',
        token: editor.token,
        body,
      });

    const draft = await create({
      question: 'What is your minimum order quantity?',
      answer: 'Usually 1,000 pieces per style.',
      keywords: ['MOQ', 'moq', 'small order'],
    });
    assert.equal(draft.status, 201);
    assert.equal(draft.json.data.published, false);
    assert.deepEqual(draft.json.data.keywords, ['moq', 'small order']); // duplicates removed

    // A draft is never given to visitors.
    assert.equal((await ask('what is your MOQ')).json.data.found, false);

    await api.call(`/api/chatbot/admin/answers/${draft.json.data.id}`, {
      method: 'PATCH',
      token: editor.token,
      body: { published: true },
    });
    const found = await ask('whats the MOQ?');
    assert.equal(found.json.data.found, true);
    assert.equal(found.json.data.answer?.answer, 'Usually 1,000 pieces per style.');

    const suggestions = await api.call<{ suggestions: { question: string }[] }>(
      '/api/chatbot/suggestions',
    );
    assert.deepEqual(
      suggestions.json.data.suggestions.map((s) => s.question),
      ['What is your minimum order quantity?'],
    );

    // Unanswered questions are grouped by meaning and counted.
    await ask('Do you have a factory in Vietnam?');
    await ask('factory in vietnam??');
    await ask('hi'); // nothing meaningful: not recorded
    const open = await api.call<QuestionView[]>('/api/chatbot/admin/unanswered', {
      token: editor.token,
    });
    const vietnam = open.json.data.find((q) => /vietnam/i.test(q.text));
    assert.equal(vietnam?.count, 2);
    assert.equal(vietnam?.text, 'factory in vietnam??');
    assert.equal(open.json.data.length, 2); // the MOQ draft miss and the Vietnam question

    // Writing an answer for it resolves it.
    const written = await create({
      question: 'Do you have factories outside Bangladesh?',
      answer: 'We work with partner factories in Bangladesh only.',
      keywords: ['Vietnam', 'other countries'],
      published: true,
      fromUnanswered: vietnam?.id,
    });
    assert.equal(written.status, 201);
    const stillOpen = await api.call<QuestionView[]>('/api/chatbot/admin/unanswered', {
      token: editor.token,
    });
    assert.equal(
      stillOpen.json.data.some((q) => q.id === vietnam?.id),
      false,
    );
    assert.equal((await ask('any factory in Vietnam')).json.data.found, true);

    // Clicking a suggested question, and feedback.
    const byId = await api.call<AskView>('/api/chatbot/ask', {
      method: 'POST',
      body: { answerId: written.json.data.id },
    });
    assert.equal(byId.json.data.answer?.id, written.json.data.id);
    const fb = await api.call(`/api/chatbot/answers/${written.json.data.id}/feedback`, {
      method: 'POST',
      body: { helpful: true },
    });
    assert.equal(fb.status, 200);

    const stats = await api.call<Record<string, number>>('/api/chatbot/admin/stats', {
      token: editor.token,
    });
    assert.equal(stats.json.data.published, 2);
    assert.equal(stats.json.data.helpful, 1);
    assert.equal(stats.json.data.answered, 3);
    assert.ok((stats.json.data.missed ?? 0) >= 3);

    const test = await api.call<{ best: { id: string; score: number } | null }>(
      '/api/chatbot/admin/test',
      { method: 'POST', token: editor.token, body: { message: 'minimum order' } },
    );
    assert.equal(test.json.data.best?.id, draft.json.data.id);
    assert.ok((test.json.data.best?.score ?? 0) > 0.5);

    // Deleting an answer reopens the questions it resolved.
    await api.call(`/api/chatbot/admin/answers/${written.json.data.id}`, {
      method: 'DELETE',
      token: editor.token,
    });
    const reopened = await api.call<QuestionView[]>('/api/chatbot/admin/unanswered', {
      token: editor.token,
    });
    assert.equal(
      reopened.json.data.some((q) => q.id === vietnam?.id),
      true,
    );
    const gone = await api.call(`/api/chatbot/answers/${written.json.data.id}/feedback`, {
      method: 'POST',
      body: { helpful: false },
    });
    assert.equal(gone.status, 404);
  });

  it('validates input', async () => {
    assert.equal((await ask('')).status, 400);
    assert.equal((await ask('x'.repeat(501))).status, 400);
    const editor = await api.signIn('admin');
    const bad = await api.call('/api/chatbot/admin/answers', {
      method: 'POST',
      token: editor.token,
      body: { question: 'Hi', answer: '' },
    });
    assert.equal(bad.status, 400);
  });
});

describe('starter answers (npm run seed:chatbot)', () => {
  it('adds every answer once, published, and never overwrites an edited one', async () => {
    const { SEED_ANSWERS } = await import('./seed-answers.js');
    const { seedChatbotAnswers } = await import('./services/chatbot.service.js');
    const { ChatAnswerModel } = await import('./models/chat-answer.model.js');
    await ChatAnswerModel.deleteMany({});
    const admin = await api.signIn('super_admin');

    const first = await seedChatbotAnswers(admin.id);
    assert.deepEqual(first, { created: SEED_ANSWERS.length, skipped: 0 });

    // Edit one, then run again: nothing is duplicated and the edit stays.
    const moq = await ChatAnswerModel.findOne({ question: /minimum order/i });
    assert.ok(moq);
    moq.answer = 'Our own wording.';
    await moq.save();
    const second = await seedChatbotAnswers(admin.id);
    assert.deepEqual(second, { created: 0, skipped: SEED_ANSWERS.length });
    assert.equal(await ChatAnswerModel.countDocuments(), SEED_ANSWERS.length);
    assert.equal((await ChatAnswerModel.findById(moq.id))?.answer, 'Our own wording.');

    // Live for visitors straight away, in the listed order.
    const sugg = await api.call<{ suggestions: { question: string }[] }>(
      '/api/chatbot/suggestions',
    );
    assert.deepEqual(
      sugg.json.data.suggestions.map((s) => s.question),
      SEED_ANSWERS.slice(0, 4).map((s) => s.question),
    );
    const res = await ask('what is the lead time for jeans?');
    assert.equal(res.json.data.found, true);
    assert.match(res.json.data.answer?.answer ?? '', /9 weeks/);
  });
});
