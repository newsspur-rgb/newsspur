import { describe, it, expect } from 'vitest';
import { kurzeHashId } from '../../src/util/hash.js';

describe('kurzeHashId', () => {
  it('liefert fuer denselben Input immer denselben Hash', () => {
    expect(kurzeHashId('https://example.com/artikel-1')).toBe(kurzeHashId('https://example.com/artikel-1'));
  });

  it('liefert fuer unterschiedlichen Input unterschiedliche Hashes', () => {
    expect(kurzeHashId('https://example.com/artikel-1')).not.toBe(kurzeHashId('https://example.com/artikel-2'));
  });

  it('liefert einen 8-stelligen Hex-String', () => {
    expect(kurzeHashId('test')).toMatch(/^[0-9a-f]{8}$/);
  });
});
