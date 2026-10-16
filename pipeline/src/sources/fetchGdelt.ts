import type { Artikel, Quelle } from '../types.js';
import { kurzeHashId } from '../util/hash.js';
import type { GdeltAbfrage } from './gdeltAbfragen.js';
import { gdeltZiel } from './gdeltZugang.js';

interface GdeltArtikelRoh {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
}

function gdeltDatumZuIso(seendate: string | undefined): string {
  const treffer = seendate?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!treffer) return new Date().toISOString();
  const [, j, m, t, h, min, s] = treffer;
  return `${j}-${m}-${t}T${h}:${min}:${s}Z`;
}

function quelleAusDomain(domain: string): Quelle {
  return { id: `gdelt-${domain}`, name: domain, typ: 'unabhaengig', land: 'INT', sprache: 'en' };
}

export async function gdeltAbrufen(
  abfrage: GdeltAbfrage,
  // GDELT lehnt seit Herbst 2026 Zeitraeume unter 60 Minuten ab ("Timespan is too short").
  // Doppelte Artikel aus der Ueberlappung fallen ueber die URL-Hash-ID raus.
  timespanMinuten = 60,
  fetchImpl: typeof fetch = fetch,
): Promise<Artikel[]> {
  const { basisUrl, headers } = gdeltZiel();
  const url = `${basisUrl}?query=${encodeURIComponent(abfrage.suchbegriff)}&mode=ArtList&maxrecords=75&format=json&timespan=${timespanMinuten}min`;
  const antwort = await fetchImpl(url, { headers, signal: AbortSignal.timeout(45_000) });
  if (!antwort.ok) {
    throw new Error(`GDELT antwortete mit Status ${antwort.status}`);
  }
  const daten = (await antwort.json()) as { articles?: GdeltArtikelRoh[] } | null;
  const roh = daten?.articles ?? [];
  return roh
    .filter((a): a is Required<Pick<GdeltArtikelRoh, 'url' | 'title'>> & GdeltArtikelRoh => Boolean(a.url && a.title))
    .map((a) => ({
      id: kurzeHashId(a.url),
      quelle: quelleAusDomain(a.domain ?? 'unbekannt'),
      titel: a.title.trim(),
      teaser: a.title.trim(), // GDELT liefert keinen separaten Anriss
      url: a.url,
      bildUrl: a.socialimage || undefined,
      veroeffentlichtAm: gdeltDatumZuIso(a.seendate),
    }));
}
