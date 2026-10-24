/**
 * Finds the published answer that best fits a visitor's question, without an AI service: the
 * question is split into meaningful words (any script, so Bangla works too), common filler words
 * are dropped, simple English endings are trimmed ("shipping" ~ "ship"), and near-misses of one
 * letter count for longer words ("shiping"). An answer's question counts most, then its keywords
 * (synonyms the team adds), then its answer text.
 */

const STOP_WORDS = new Set(
  (
    'a an the and or but if of to in on at by for with from about as into than then so is are was ' +
    'were be been being do does did can could will would shall should may might must have has had ' +
    'i me my we our us you your he she it its they them their this that these those there here ' +
    'what which who whom whose when where why how please hi hello hey thanks thank any some ' +
    'tell know want need like just also get give us much many more most use used'
  ).split(' '),
);

/** Trims common English endings so word forms meet: "orders" / "ordering" -> "order". */
function stem(word: string): string {
  if (!/^[a-z]+$/.test(word) || word.length <= 4) return word;
  for (const suffix of ['ing', 'edly', 'ed', 'ies', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      const base = word.slice(0, -suffix.length);
      if (suffix === 'ies') return `${base}y`;
      // A doubled final consonant: "shipping" -> "shipp" -> "ship", "planned" -> "plan".
      if ((suffix === 'ing' || suffix === 'ed') && /([b-df-hj-np-tv-z])\1$/.test(base)) {
        return /(ll|ss|ff|zz)$/.test(base) ? base : base.slice(0, -1);
      }
      return base;
    }
  }
  return word;
}

/** Lower-cased meaningful words, stemmed, without duplicates. */
export function tokenize(text: string): string[] {
  const words = text
    .normalize('NFKC')
    .toLowerCase()
    .match(/[\p{L}\p{M}\p{N}]+/gu);
  if (!words) return [];
  const out = new Set<string>();
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue;
    if (w.length < 2) continue;
    // Quantities and sizes ("5000", "40") say nothing about what a question is about.
    if (/^\p{N}+$/u.test(w)) continue;
    out.add(stem(w));
  }
  return [...out];
}

/** True when two words differ by at most one edit (insert, delete or substitute). */
function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** 1 for the same word, 0.8 for a one-letter slip in a longer word, else 0. */
function wordMatch(word: string, candidates: Set<string>): number {
  if (candidates.has(word)) return 1;
  if (word.length >= 5) {
    for (const c of candidates) if (c.length >= 5 && oneEditApart(word, c)) return 0.8;
  }
  return 0;
}

export interface MatchableAnswer {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

export interface IndexedAnswer extends MatchableAnswer {
  questionWords: Set<string>;
  keywordWords: Set<string>;
  answerWords: Set<string>;
  /** Whole keyword phrases, lower-cased, matched as phrases too ("lead time"). */
  phrases: string[];
}

export function indexAnswer(a: MatchableAnswer): IndexedAnswer {
  return {
    ...a,
    questionWords: new Set(tokenize(a.question)),
    keywordWords: new Set(a.keywords.flatMap(tokenize)),
    answerWords: new Set(tokenize(a.answer)),
    phrases: a.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.includes(' ')),
  };
}

const WEIGHT = { question: 1, keyword: 1.2, answer: 0.35 };

/** How well an answer fits, from 0 (no overlap) to about 1 (every word found in its question). */
export function score(query: string, words: string[], a: IndexedAnswer): number {
  // A keyword phrase as whole words ("who are you", "lead time"), not inside other words.
  const normalized = ` ${query
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')} `;
  const phraseHit = a.phrases.some((p) => normalized.includes(` ${p} `));
  // Only common words ("who are you"): a matching phrase is the only signal there is.
  if (words.length === 0) return phraseHit ? 0.6 : 0;
  let total = 0;
  for (const w of words) {
    total += Math.max(
      wordMatch(w, a.questionWords) * WEIGHT.question,
      wordMatch(w, a.keywordWords) * WEIGHT.keyword,
      wordMatch(w, a.answerWords) * WEIGHT.answer,
    );
  }
  // Coverage of the visitor's words, so long questions are not favoured just for being long.
  return Math.min(1.5, total / words.length + (phraseHit ? 0.25 : 0));
}

/** An answer counts as found from this score; below it the visitor gets suggestions instead. */
export const ANSWER_THRESHOLD = 0.55;
/** Weaker matches still worth offering as "Did you mean…". */
export const SUGGEST_THRESHOLD = 0.2;

export interface MatchResult {
  best: { answer: IndexedAnswer; score: number } | null;
  suggestions: IndexedAnswer[];
}

export function findAnswer(query: string, answers: IndexedAnswer[]): MatchResult {
  const words = tokenize(query);
  const ranked = answers
    .map((answer) => ({ answer, score: score(query, words, answer) }))
    .filter((r) => r.score >= SUGGEST_THRESHOLD)
    .sort((x, y) => y.score - x.score);
  const top = ranked[0];
  if (top && top.score >= ANSWER_THRESHOLD) {
    return {
      best: top,
      suggestions: ranked.slice(1, 4).map((r) => r.answer),
    };
  }
  return { best: null, suggestions: ranked.slice(0, 3).map((r) => r.answer) };
}
