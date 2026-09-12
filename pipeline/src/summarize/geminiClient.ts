export interface GeminiClient {
  strukturierteAntwort(prompt: string, schema: object): Promise<unknown>;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

export function erstelleGeminiClient(apiKey: string, fetchImpl: typeof fetch = fetch): GeminiClient {
  return {
    async strukturierteAntwort(prompt: string, schema: object): Promise<unknown> {
      const antwort = await fetchImpl(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
        }),
      });
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
