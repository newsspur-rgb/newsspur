import { describe, it, expect, vi } from 'vitest';
import { erstelleR2ReelSpeicher } from '../../src/reel/reelSpeicher.js';

describe('erstelleR2ReelSpeicher', () => {
  it('laedt die Datei per PUT an die R2-REST-API hoch, mit Bearer-Token und video/mp4', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    const leseDatei = vi.fn(async () => Buffer.from('fake-mp4-inhalt'));
    const speicher = erstelleR2ReelSpeicher('acc', 'newsspur-reels', 'token', fetchImpl, leseDatei);

    await speicher.speichern('demo.mp4', '/tmp/demo.mp4');

    expect(leseDatei).toHaveBeenCalledWith('/tmp/demo.mp4');
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/r2/buckets/newsspur-reels/objects/demo.mp4');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer token');
    expect(init.headers['Content-Type']).toBe('video/mp4');
  });

  it('wirft einen Fehler bei fehlerhafter HTTP-Antwort', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const leseDatei = vi.fn(async () => Buffer.from('x'));
    const speicher = erstelleR2ReelSpeicher('acc', 'newsspur-reels', 'token', fetchImpl, leseDatei);

    await expect(speicher.speichern('demo.mp4', '/tmp/demo.mp4')).rejects.toThrow('500');
  });
});
