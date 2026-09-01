export type EmbedFn = (texte: string[]) => Promise<number[][]>;

const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

export function erstelleGeminiEmbedFn(apiKey: string, fetchImpl: typeof fetch = fetch): EmbedFn {
  return async (texte: string[]) => {
    const ergebnisse: number[][] = [];
    for (const text of texte) {
      const antwort = await fetchImpl(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      });
      if (!antwort.ok) {
        throw new Error(`Gemini-Embedding antwortete mit Status ${antwort.status}`);
      }
      const daten = (await antwort.json()) as { embedding?: { values?: number[] } };
      ergebnisse.push(daten.embedding?.values ?? []);
    }
    return ergebnisse;
  };
}
