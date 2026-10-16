import { describe, it, expect, vi } from 'vitest';
import { erstelleGeminiClient } from '../../src/summarize/geminiClient.js';

function fakeFetch(text: string, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok: status < 400, status,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  })) as unknown as typeof fetch;
}

describe('erstelleGeminiClient', () => {
  it('parst die strukturierte JSON-Antwort', async () => {
    const client = erstelleGeminiClient('k', fakeFetch(JSON.stringify({ hallo: 'welt' })));
    expect(await client.strukturierteAntwort('p', { type: 'object' })).toEqual({ hallo: 'welt' });
  });

  it('wirft einen Fehler bei fehlerhafter HTTP-Antwort', async () => {
    const client = erstelleGeminiClient('k', fakeFetch('', 500));
    await expect(client.strukturierteAntwort('p', {})).rejects.toThrow('500');
  });

  it('wiederholt bei 503 und liefert die spätere Antwort', async () => {
    const antworten = [503, 503, 200];
    const fetchImpl = vi.fn(async () => {
      const status = antworten.shift()!;
      return { ok: status < 400, status, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }) };
    }) as unknown as typeof fetch;
    const client = erstelleGeminiClient('k', fetchImpl, [0, 0]);
    expect(await client.strukturierteAntwort('p', {})).toEqual({ a: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('gibt nach den Wiederholungen bei dauerhaftem 503 auf', async () => {
    const fetchImpl = fakeFetch('', 503);
    await expect(erstelleGeminiClient('k', fetchImpl, [0, 0]).strukturierteAntwort('p', {})).rejects.toThrow('503');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('wiederholt andere Fehler (z. B. 429) nicht', async () => {
    const fetchImpl = fakeFetch('', 429);
    await expect(erstelleGeminiClient('k', fetchImpl, [0, 0]).strukturierteAntwort('p', {})).rejects.toThrow('429');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('wirft einen Fehler, wenn kein Text in der Antwort steht', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    const client = erstelleGeminiClient('k', fetchImpl);
    await expect(client.strukturierteAntwort('p', {})).rejects.toThrow('keinen Text');
  });
});
