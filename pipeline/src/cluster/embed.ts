export type EmbedFn = (texte: string[]) => Promise<number[][]>;

const MODELL = 'gemini-embedding-001';
const GEMINI_BATCH_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODELL}:batchEmbedContents`;
// Free-Tier-Limit: 100 Embedding-Anfragen pro Minute (zaehlt pro Text, auch innerhalb eines Batch-Aufrufs).
const BATCH_GROESSE = 100;
const RETRY_VERSUCHE_MAX = 5;
const STANDARD_WARTEZEIT_MS = 31_000;
// Ein Batch von BATCH_GROESSE=100 schoepft das Minutenlimit bereits vollstaendig aus,
// daher muss die Pause zwischen Batches laenger als das 60s-Zeitfenster sein - sonst
// faellt der naechste Batch garantiert in dasselbe Fenster und bekommt sofort 429
// (beobachtet: alle Laeufe mit >100 Artikeln scheiterten zuverlaessig mit 31s Pause).
const ZWISCHEN_BATCHES_WARTEZEIT_MS = 65_000;

function chunk<T>(werte: T[], groesse: number): T[][] {
  const gruppen: T[][] = [];
  for (let i = 0; i < werte.length; i += groesse) gruppen.push(werte.slice(i, i + groesse));
  return gruppen;
}

function wartezeitAusFehler(fehlerText: string): number {
  const treffer = fehlerText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return treffer ? Math.ceil(parseFloat(treffer[1]) * 1000) : STANDARD_WARTEZEIT_MS;
}

function warte(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function batchMitRateLimitRetry(
  aufruf: () => Promise<Response>,
  versucheMax = RETRY_VERSUCHE_MAX,
): Promise<Response> {
  let versuch = 0;
  for (;;) {
    const antwort = await aufruf();
    if (antwort.status !== 429 || versuch >= versucheMax) return antwort;
    versuch += 1;
    await warte(wartezeitAusFehler(await antwort.clone().text()));
  }
}

export function erstelleGeminiEmbedFn(apiKey: string, fetchImpl: typeof fetch = fetch): EmbedFn {
  return async (texte: string[]) => {
    const ergebnisse: number[][] = [];
    const gruppen = chunk(texte, BATCH_GROESSE);
    for (let i = 0; i < gruppen.length; i += 1) {
      if (i > 0) await warte(ZWISCHEN_BATCHES_WARTEZEIT_MS);
      const antwort = await batchMitRateLimitRetry(() =>
        fetchImpl(`${GEMINI_BATCH_EMBED_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: gruppen[i].map((text) => ({
              model: `models/${MODELL}`,
              content: { parts: [{ text }] },
            })),
          }),
        }),
      );
      if (!antwort.ok) {
        throw new Error(`Gemini-Embedding antwortete mit Status ${antwort.status}`);
      }
      const daten = (await antwort.json()) as { embeddings?: Array<{ values?: number[] }> };
      for (const e of daten.embeddings ?? []) ergebnisse.push(e.values ?? []);
    }
    return ergebnisse;
  };
}
