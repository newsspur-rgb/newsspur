import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { erstelleGeminiEmbedFn } from '../../src/cluster/embed.js';

describe('erstelleGeminiEmbedFn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ruft die Batch-Embedding-API einmal fuer alle Texte auf und gibt die Vektoren zurueck', async () => {
    const vektoren: Record<string, number[]> = { 'Text A': [1, 2, 3], 'Text B': [4, 5, 6] };
    const fetchImpl = vi.fn(async (_url: string, init: any) => {
      const anfragen = JSON.parse(init.body).requests as Array<{ content: { parts: [{ text: string }] } }>;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          embeddings: anfragen.map((a) => ({ values: vektoren[a.content.parts[0].text] })),
        }),
      };
    }) as unknown as typeof fetch;

    const embedFn = erstelleGeminiEmbedFn('test-key', fetchImpl);
    const ergebnisPromise = embedFn(['Text A', 'Text B']);
    await vi.runAllTimersAsync();
    expect(await ergebnisPromise).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('teilt mehr als 100 Texte in mehrere Batch-Aufrufe auf und wartet dazwischen (Minutenlimit)', async () => {
    const texte = Array.from({ length: 150 }, (_, i) => `Text ${i}`);
    const fetchImpl = vi.fn(async (_url: string, init: any) => {
      const anfragen = JSON.parse(init.body).requests as Array<unknown>;
      return {
        ok: true,
        status: 200,
        json: async () => ({ embeddings: anfragen.map(() => ({ values: [1] })) }),
      };
    }) as unknown as typeof fetch;

    const embedFn = erstelleGeminiEmbedFn('test-key', fetchImpl);
    const ergebnisPromise = embedFn(texte);
    await vi.runAllTimersAsync();
    const ergebnis = await ergebnisPromise;
    expect(ergebnis).toHaveLength(150);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('wiederholt bei Status 429 nach der von Google genannten Wartezeit und gibt bei Erfolg das Ergebnis zurueck', async () => {
    let aufrufe = 0;
    const fetchImpl = vi.fn(async () => {
      aufrufe += 1;
      if (aufrufe < 3) {
        return {
          ok: false,
          status: 429,
          clone() {
            return this;
          },
          text: async () => '{"error":{"details":[{"retryDelay":"2s"}]}}',
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({ embeddings: [{ values: [9] }] }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const embedFn = erstelleGeminiEmbedFn('test-key', fetchImpl);
    const promise = embedFn(['x']);
    await vi.runAllTimersAsync();
    expect(await promise).toEqual([[9]]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('wirft einen Fehler bei anhaltend fehlerhafter Antwort', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const promise = erstelleGeminiEmbedFn('k', fetchImpl)(['x']);
    await expect(promise).rejects.toThrow('500');
  });
});
