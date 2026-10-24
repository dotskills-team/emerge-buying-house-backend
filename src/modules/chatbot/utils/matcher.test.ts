import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findAnswer, indexAnswer, tokenize } from './matcher.js';

const answers = [
  {
    id: 'moq',
    question: 'What is your minimum order quantity?',
    answer: 'Our usual minimum is 1,000 pieces per style.',
    keywords: ['MOQ', 'minimum', 'small order'],
  },
  {
    id: 'lead',
    question: 'How long does production take?',
    answer: 'Bulk production usually takes 60 to 90 days after sample approval.',
    keywords: ['lead time', 'delivery time', 'how many days'],
  },
  {
    id: 'shipping',
    question: 'Which shipping terms do you offer?',
    answer: 'We ship FOB Chattogram or CIF to your port.',
    keywords: ['incoterms', 'FOB', 'CIF'],
  },
  {
    id: 'bangla',
    question: 'আপনাদের অফিস কোথায়?',
    answer: 'আমাদের অফিস উত্তরা, ঢাকায়।',
    keywords: ['ঠিকানা', 'office address'],
  },
].map(indexAnswer);

const best = (q: string) => findAnswer(q, answers).best?.answer.id ?? null;

describe('tokenize', () => {
  it('keeps meaningful words, drops filler and trims word endings', () => {
    assert.deepEqual(tokenize('What are the shipping terms?'), ['ship', 'term']);
    assert.deepEqual(tokenize('5000 pcs, 40 colours'), ['pcs', 'colour']);
    assert.deepEqual(tokenize('Orders, ORDERING and ordered'), ['order']);
    assert.deepEqual(tokenize('আপনাদের অফিস কোথায়?'), ['আপনাদের', 'অফিস', 'কোথায়']);
  });
});

describe('findAnswer', () => {
  it('finds the answer for the same question in other words', () => {
    assert.equal(best('minimum order quantity'), 'moq');
    assert.equal(best("what's your MOQ"), 'moq');
    assert.equal(best('Can I place a small order?'), 'moq');
    assert.equal(best('what is the lead time'), 'lead');
    assert.equal(best('how long is production'), 'lead');
    assert.equal(best('do you ship CIF?'), 'shipping');
    assert.equal(best('অফিস কোথায়'), 'bangla');
  });

  it('forgives a one-letter typo in longer words', () => {
    assert.equal(best('shiping terms'), 'shipping');
    assert.equal(best('minimun order'), 'moq');
  });

  it('does not answer questions it has nothing for, but may suggest', () => {
    assert.equal(best('Do you have a factory in Vietnam?'), null);
    assert.equal(best('hello'), null);
    assert.equal(best(''), null);
    const unsure = findAnswer('order', answers);
    assert.equal(unsure.best?.answer.id ?? null, 'moq');
  });
});
