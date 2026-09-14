import { describe, it, expect } from 'vitest';
import { sollReelWerden, REEL_WICHTIGKEIT_SCHWELLE } from '../../src/reel/auswahl.js';

describe('sollReelWerden', () => {
  it('ist wahr bei ausreichender Wichtigkeit und noch keinem Reel heute', () => {
    expect(sollReelWerden(REEL_WICHTIGKEIT_SCHWELLE, false)).toBe(true);
  });

  it('ist falsch unterhalb der Wichtigkeits-Schwelle', () => {
    expect(sollReelWerden(REEL_WICHTIGKEIT_SCHWELLE - 1, false)).toBe(false);
  });

  it('ist falsch, wenn heute schon ein Reel gesendet wurde, unabhaengig von der Wichtigkeit', () => {
    expect(sollReelWerden(100, true)).toBe(false);
  });
});
