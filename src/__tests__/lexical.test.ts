import { describe, it, expect } from 'vitest';
import {
  addDomainAliases,
  hasNearWord,
  makeWordSet,
  normalizeWord,
  withinOneEdit,
} from '../tools/lexical.js';

describe('normalizeWord', () => {
  it('folds simple plurals', () => {
    expect(normalizeWord('orders')).toBe('order');
    expect(normalizeWord('fees')).toBe('fee');
    expect(normalizeWord('positions')).toBe('position');
  });

  it('does not mangle words ending in ss/us/is', () => {
    expect(normalizeWord('status')).toBe('status');
    expect(normalizeWord('analysis')).toBe('analysis');
    expect(normalizeWord('access')).toBe('access');
  });

  it('strips punctuation and lowercases', () => {
    expect(normalizeWord('Order-Entry!')).toBe('orderentry');
  });
});

describe('makeWordSet', () => {
  it('includes raw and normalized forms', () => {
    const words = makeWordSet('Deposits and orders');
    expect(words.has('deposits')).toBe(true);
    expect(words.has('deposit')).toBe(true);
    expect(words.has('order')).toBe(true);
  });

  it('drops single-character tokens', () => {
    expect(makeWordSet('a b c').size).toBe(0);
  });
});

describe('withinOneEdit', () => {
  it('accepts one insertion, deletion, or substitution', () => {
    expect(withinOneEdit('positon', 'position')).toBe(true);
    expect(withinOneEdit('order', 'orders')).toBe(true);
    expect(withinOneEdit('cat', 'cut')).toBe(true);
  });

  it('rejects distant words', () => {
    expect(withinOneEdit('order', 'orderly')).toBe(false);
    expect(withinOneEdit('deposit', 'positon')).toBe(false);
  });
});

describe('hasNearWord', () => {
  it('finds a one-edit neighbour in a word set', () => {
    expect(hasNearWord(makeWordSet('position management'), 'positon')).toBe(true);
    expect(hasNearWord(makeWordSet('deposit withdrawal'), 'positon')).toBe(false);
  });
});

describe('addDomainAliases', () => {
  it('adds spelled-out domain abbreviations', () => {
    const words = new Set<string>();
    addDomainAliases(words, 'Take Profit and Stop Loss on perpetual futures');
    expect(words.has('tp')).toBe(true);
    expect(words.has('sl')).toBe(true);
    expect(words.has('perp')).toBe(true);
  });

  it('adds RWA and cross-chain aliases', () => {
    const words = new Set<string>();
    addDomainAliases(words, 'Real-World Assets and cross-chain transfers');
    expect(words.has('rwa')).toBe(true);
    expect(words.has('crosschain')).toBe(true);
  });

  it('adds nothing for unrelated text', () => {
    const words = new Set<string>();
    addDomainAliases(words, 'wallet connection');
    expect(words.size).toBe(0);
  });
});
