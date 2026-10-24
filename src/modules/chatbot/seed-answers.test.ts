import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SEED_ANSWERS } from './seed-answers.js';
import { findAnswer, indexAnswer } from './utils/matcher.js';

const index = SEED_ANSWERS.map((s) => indexAnswer({ id: s.key, ...s }));
const answerFor = (q: string) => findAnswer(q, index).best?.answer.id ?? null;

/** How buyers really ask: short, long, typos, Bangla. Each must reach the right answer. */
const CASES: Array<[string, string]> = [
  ['how can I get a quotation', 'quote'],
  ['what is the price for 5000 t-shirts', 'quote'],
  ['send me your prices', 'quote'],
  ['দাম কত', 'quote'],
  ['what is your MOQ', 'moq'],
  ['minimum order quantity?', 'moq'],
  ['can I order a small quantity', 'moq'],
  ['minimun order', 'moq'],
  ['সর্বনিম্ন অর্ডার কত', 'moq'],
  ['what is the lead time', 'lead-time'],
  ['how many days for bulk production', 'lead-time'],
  ['delivery time?', 'lead-time'],
  ['ডেলিভারি কতদিনে', 'lead-time'],
  ['what products do you make', 'products'],
  ['do you make jeans', 'products'],
  ['can you produce hoodies and sweaters', 'products'],
  ['private label for my store', 'products'],
  ['who are you', 'about'],
  ['what is a buying house', 'about'],
  ['how do I place an order', 'process'],
  ['what are the steps', 'process'],
  ['can I get a sample first', 'samples'],
  ['do you have BSCI', 'certifications'],
  ['are your factories GOTS certified', 'certifications'],
  ['how do you check quality', 'quality'],
  ['do you do AQL inspection', 'quality'],
  ['are factories safe for workers', 'compliance'],
  ['do you use organic cotton', 'sustainability'],
  ['where is your office', 'location'],
  ['অফিস কোথায়', 'location'],
  ['what is your phone number', 'contact'],
  ['what are your working hours', 'contact'],
  ['do you export to USA', 'export'],
  ['do you ship FOB', 'shipping'],
  ['can I track my order', 'tracking'],
  ['since when are you in business', 'experience'],
  ['any job vacancy', 'careers'],
];

describe('starter answers', () => {
  it('have unique questions and stay within the stored limits', () => {
    const questions = SEED_ANSWERS.map((s) => s.question.toLowerCase());
    assert.equal(new Set(questions).size, questions.length);
    for (const s of SEED_ANSWERS) {
      assert.ok(s.question.length >= 5 && s.question.length <= 200, s.key);
      assert.ok(s.answer.length <= 2000, s.key);
      assert.ok(s.keywords.length <= 20, s.key);
      assert.ok(
        s.keywords.every((k) => k.length <= 60),
        s.key,
      );
    }
  });

  for (const [question, expected] of CASES) {
    it(`answers "${question}"`, () => {
      assert.equal(answerFor(question), expected);
    });
  }

  it('does not pretend to know what it was never told', () => {
    for (const q of ['do you sell shoes', 'what is the weather today', 'tell me a joke']) {
      assert.equal(answerFor(q), null, q);
    }
  });
});
