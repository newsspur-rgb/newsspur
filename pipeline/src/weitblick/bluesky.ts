/**
 * "Stimmung nach Sprache": oeffentliche Bluesky-Posts zu einer Entwicklung, gruppiert nach Sprachraum.
 * Bluesky kennt kein Herkunftsland - nur die vom Nutzer angegebene Sprache (oft ungenau).
 * Daher ausdruecklich NICHT repraesentativ; Gemini sortiert themenfremde/falschsprachige Posts aus.
 */

const BLUESKY_SUCHE = 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts';
const POSTS_PRO_SPRACHE = 6;
const MAX_TEXT = 220;
/** Unter so vielen Posts wird ein Sprachraum weggelassen - zu wenig fuer eine Aussage. */
export const MIN_POSTS = 3;

export interface Sprachraum {
  name: string;
  sprachen: string[];
}

export const SPRACHRAEUME: Sprachraum[] = [
  { name: 'Englischsprachig (v. a. USA)', sprachen: ['en'] },
  { name: 'Arabisch', sprachen: ['ar'] },
  { name: 'Hebräisch (Israel)', sprachen: ['he'] },
  { name: 'Persisch (Iran)', sprachen: ['fa'] },
  { name: 'Russisch', sprachen: ['ru'] },
  { name: 'Chinesisch', sprachen: ['zh'] },
  { name: 'Japanisch', sprachen: ['ja'] },
  { name: 'Turkvölker', sprachen: ['tr', 'az', 'kk', 'uz', 'ky'] },
  { name: 'Portugiesisch', sprachen: ['pt'] },
  { name: 'Spanisch', sprachen: ['es'] },
  { name: 'Französisch', sprachen: ['fr'] },
  { name: 'Deutsch', sprachen: ['de'] },
];

export interface BlueskyPost {
  text: string;
  autor: string;
  sprache: string;
  likes: number;
  url: string;
}

export interface SprachraumPosts {
  sprachraum: string;
  posts: BlueskyPost[];
}

interface PostRoh {
  uri: string;
  author?: { handle?: string };
  record?: { text?: string };
  likeCount?: number;
}

/** Sprachen mit eigener Schrift: ein Post zaehlt nur, wenn er diese Schrift auch wirklich enthaelt
 *  (die Bluesky-Sprachangabe ist oft falsch - z. B. englische Posts mit Sprache "ar"). */
const SCHRIFT: Record<string, RegExp> = {
  ar: /[؀-ۿ]/,
  fa: /[؀-ۿ]/,
  he: /[֐-׿]/,
  ru: /[Ѐ-ӿ]/,
  kk: /[Ѐ-ӿ]/,
  ky: /[Ѐ-ӿ]/,
  zh: /[一-鿿]/,
  ja: /[぀-ヿ一-鿿]/,
};

export function passtZurSchrift(text: string, sprache: string): boolean {
  const schrift = SCHRIFT[sprache];
  if (!schrift) return true; // lateinische Schrift - Gemini sortiert falsche Sprachen aus
  const treffer = text.match(new RegExp(schrift.source, 'g'))?.length ?? 0;
  return treffer >= 5;
}

/** at://did:plc:x/app.bsky.feed.post/RKEY -> https://bsky.app/profile/HANDLE/post/RKEY */
export function postUrl(uri: string, handle: string): string {
  const rkey = uri.split('/').pop() ?? '';
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

async function suchen(begriffe: string, sprache: string, seitIso: string, fetchImpl: typeof fetch): Promise<BlueskyPost[]> {
  // mehr holen als gebraucht, weil der Schrift-Filter einen Teil verwirft
  const params = new URLSearchParams({ q: begriffe, lang: sprache, sort: 'top', limit: String(POSTS_PRO_SPRACHE * 4), since: seitIso });
  const antwort = await fetchImpl(`${BLUESKY_SUCHE}?${params}`, { signal: AbortSignal.timeout(20_000) });
  if (!antwort.ok) throw new Error(`Bluesky antwortete mit Status ${antwort.status}`);
  const daten = (await antwort.json()) as { posts?: PostRoh[] };
  return (daten.posts ?? [])
    .filter((p) => p.record?.text && p.author?.handle && passtZurSchrift(p.record.text, sprache))
    .map((p) => ({
      text: p.record!.text!.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT),
      autor: p.author!.handle!,
      sprache,
      likes: p.likeCount ?? 0,
      url: postUrl(p.uri, p.author!.handle!),
    }));
}

export const ALLE_SPRACHEN = SPRACHRAEUME.flatMap((r) => r.sprachen);

/**
 * Posts je Sprachraum (letzte 7 Tage). `uebersetzt` enthaelt je Sprache den Suchtext in deren Schrift
 * (z. B. ar: "ترامب أوكرانيا") - lateinische Begriffe finden keine arabischen/kyrillischen Posts.
 * Fehlt eine Sprache, werden die englischen Suchbegriffe genutzt. Fehler einzelner Sprachen werden ignoriert.
 */
export async function blueskyStimmenSammeln(
  suchbegriffe: string[],
  uebersetzt: Record<string, string>,
  seitIso: string,
  fetchImpl: typeof fetch = fetch,
  pauseMs = 300,
): Promise<SprachraumPosts[]> {
  const ergebnis: SprachraumPosts[] = [];
  for (const raum of SPRACHRAEUME) {
    const posts: BlueskyPost[] = [];
    for (const sprache of raum.sprachen) {
      const begriffe = uebersetzt[sprache]?.trim() || suchbegriffe.join(' ');
      try {
        posts.push(...(await suchen(begriffe, sprache, seitIso, fetchImpl)));
      } catch (fehlerUrsache) {
        console.warn(`Bluesky-Suche (${sprache}) fehlgeschlagen:`, fehlerUrsache);
      }
      if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    }
    if (posts.length >= MIN_POSTS) {
      ergebnis.push({ sprachraum: raum.name, posts: posts.sort((a, b) => b.likes - a.likes).slice(0, POSTS_PRO_SPRACHE) });
    }
  }
  return ergebnis;
}
