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

  it('wirft einen Fehler, wenn kein Text in der Antwort steht', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    const client = erstelleGeminiClient('k', fetchImpl);
    await expect(client.strukturierteAntwort('p', {})).rejects.toThrow('keinen Text');
  });
});
