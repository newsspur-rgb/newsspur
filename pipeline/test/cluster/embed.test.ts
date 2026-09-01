import { describe, it, expect, vi } from 'vitest';
import { erstelleGeminiEmbedFn } from '../../src/cluster/embed.js';

describe('erstelleGeminiEmbedFn', () => {
  it('ruft fuer jeden Text die Embedding-API auf und gibt die Vektoren zurueck', async () => {
    const vektoren: Record<string, number[]> = { 'Text A': [1, 2, 3], 'Text B': [4, 5, 6] };
    const fetchImpl = vi.fn(async (_url: string, init: any) => {
      const text = JSON.parse(init.body).content.parts[0].text as string;
      return { ok: true, status: 200, json: async () => ({ embedding: { values: vektoren[text] } }) };
    }) as unknown as typeof fetch;

    const embedFn = erstelleGeminiEmbedFn('test-key', fetchImpl);
    expect(await embedFn(['Text A', 'Text B'])).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('wirft einen Fehler bei fehlerhafter Antwort', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429 })) as unknown as typeof fetch;
    await expect(erstelleGeminiEmbedFn('k', fetchImpl)(['x'])).rejects.toThrow('429');
  });
});
