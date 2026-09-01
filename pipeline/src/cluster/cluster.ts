import type { Artikel, Thema } from '../types.js';
import { kurzeHashId } from '../util/hash.js';
import type { EmbedFn } from './embed.js';

export interface BuendelOptionen {
  embedFn?: EmbedFn;
  /** Standard: 0.82 mit Embedding, 0.25 ohne (grober Wortabgleich). */
  aehnlichkeitsSchwelle?: number;
  /** Standard: 48. */
  zeitfensterStunden?: number;
}

function kosinusAehnlichkeit(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Vergleichstext eines Themas: die erste (urspruengliche) Meldung. Bleibt
 *  stabil, waehrend das Thema waechst -> verhindert Themendrift und haelt
 *  den Embedding-Cache gueltig. */
function themenText(thema: Thema): string {
  const erster = thema.artikel[0];
  return `${erster.titel}. ${erster.teaser}`;
}

function schlagwoerter(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3),
  );
}

function wortAehnlichkeit(a: string, b: string): number {
  const wa = schlagwoerter(a);
  const wb = schlagwoerter(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let schnitt = 0;
  for (const w of wa) if (wb.has(w)) schnitt++;
  return schnitt / Math.min(wa.size, wb.size);
}

function innerhalbZeitfenster(a: string, b: string, stunden: number): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= stunden * 3_600_000;
}

export async function buendeln(
  neueArtikel: Artikel[],
  bestehendeThemen: Thema[],
  optionen: BuendelOptionen = {},
): Promise<{ neueThemen: Thema[]; aktualisierteThemen: Thema[] }> {
  const schwelle = optionen.aehnlichkeitsSchwelle ?? (optionen.embedFn ? 0.82 : 0.25);
  const zeitfenster = optionen.zeitfensterStunden ?? 48;
  const jetzt = new Date().toISOString();

  const neueThemen: Thema[] = [];
  const aktualisierteThemen: Thema[] = [];
  const aktualisierteIds = new Set<string>();

  let cache: Map<string, number[]> | null = null;
  if (optionen.embedFn) {
    const texte = [
      ...bestehendeThemen.map(themenText),
      ...neueArtikel.map((a) => `${a.titel}. ${a.teaser}`),
    ];
    const vektoren = await optionen.embedFn(texte);
    cache = new Map(texte.map((t, i) => [t, vektoren[i]]));
  }

  const aehnlichkeit = (textA: string, textB: string): number => {
    if (cache) {
      const va = cache.get(textA);
      const vb = cache.get(textB);
      if (va && vb) return kosinusAehnlichkeit(va, vb);
    }
    return wortAehnlichkeit(textA, textB);
  };

  for (const artikel of neueArtikel) {
    const artikelText = `${artikel.titel}. ${artikel.teaser}`;
    const kandidaten: Thema[] = [
      ...bestehendeThemen.filter((t) => innerhalbZeitfenster(t.aktualisiert, artikel.veroeffentlichtAm, zeitfenster)),
      ...neueThemen,
    ];

    let bestesThema: Thema | null = null;
    let beste = 0;
    for (const kandidat of kandidaten) {
      const wert = aehnlichkeit(themenText(kandidat), artikelText);
      if (wert > beste) {
        beste = wert;
        bestesThema = kandidat;
      }
    }

    if (bestesThema && beste >= schwelle) {
      bestesThema.artikel.push(artikel);
      bestesThema.aktualisiert = jetzt;
      if (bestehendeThemen.includes(bestesThema) && !aktualisierteIds.has(bestesThema.id)) {
        aktualisierteIds.add(bestesThema.id);
        aktualisierteThemen.push(bestesThema);
      }
    } else {
      neueThemen.push({ id: kurzeHashId(`${artikel.url}-${jetzt}`), artikel: [artikel], erstellt: jetzt, aktualisiert: jetzt });
    }
  }

  return { neueThemen, aktualisierteThemen };
}
