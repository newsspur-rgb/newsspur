export interface GeminiClient {
  strukturierteAntwort(prompt: string, schema: object): Promise<unknown>;
}

export const STANDARD_MODELL = 'gemini-3.6-flash';
const geminiUrl = (modell: string) => `https://generativelanguage.googleapis.com/v1beta/models/${modell}:generateContent`;

/** Wartezeiten vor erneutem Versuch, wenn Gemini mit 503 ("high demand") antwortet - temporaere Lastspitzen bei Google. */
const WIEDERHOLUNGS_PAUSEN_MS = [20_000, 60_000];

export function erstelleGeminiClient(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  pausenMs: number[] = WIEDERHOLUNGS_PAUSEN_MS,
  modell: string = STANDARD_MODELL,
): GeminiClient {
  return {
    async strukturierteAntwort(prompt: string, schema: object): Promise<unknown> {
      const anfrage = () =>
        fetchImpl(`${geminiUrl(modell)}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
          }),
        });
      let antwort = await anfrage();
      for (const pause of pausenMs) {
        if (antwort.status !== 503) break;
        await new Promise((r) => setTimeout(r, pause));
        antwort = await anfrage();
      }
      if (!antwort.ok) {
        throw new Error(`Gemini antwortete mit Status ${antwort.status}`);
      }
      const daten = (await antwort.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = daten.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini-Antwort enthielt keinen Text');
      }
      return JSON.parse(text);
    },
  };
}
