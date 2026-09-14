import { describe, it, expect } from 'vitest';
import { reelHintergrundErzeugen } from '../../src/reel/hintergrund.js';

describe('reelHintergrundErzeugen', () => {
  it('erzeugt ein gueltiges 1080x1920-PNG', async () => {
    const png = await reelHintergrundErzeugen({ deutschland: 90, tuerkei: 20, nahost: 0 });
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.length).toBeGreaterThan(1000);
  });
});
