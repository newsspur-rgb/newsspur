import { execFile } from 'node:child_process';

/**
 * X/Twitter-Suche über OpenCLI (Chrome-Erweiterung im eingeloggten Chrome des Mac).
 * Läuft deshalb NICHT auf GitHub Actions, sondern nur lokal (launchd, siehe docs).
 */

export interface Tweet {
  id: string;
  autor: string;
  text: string;
  /** ISO-Zeitpunkt */
  zeit: string;
  likes: number;
  url: string;
  /** Vorschaubild (Foto oder Video-Thumbnail), falls der Post Medien hat. */
  posterUrl?: string;
  istVideo: boolean;
}

export type BefehlAusfuehren = (args: string[], timeoutMs: number) => Promise<string>;

const SUCH_TIMEOUT_MS = 120_000;
const MAX_TEXT = 400;

export const opencliAusfuehren: BefehlAusfuehren = (args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile('opencli', args, { timeout: timeoutMs, maxBuffer: 20_000_000 }, (fehler, stdout) => {
      // OpenCLI beendet sich manchmal nicht sauber, die Ausgabe ist dann trotzdem vollständig.
      if (fehler && !stdout.trim()) return reject(fehler);
      resolve(stdout);
    });
  });

interface TweetRoh {
  id?: string;
  author?: string;
  text?: string;
  created_at?: string;
  likes?: number;
  media_urls?: string[];
  media_posters?: string[];
}

/** Video erkennt man am .mp4 in media_urls; media_posters liefert dann das Vorschaubild. */
function istVideoUrl(url: string | undefined): boolean {
  return !!url && /\.mp4(\?|$)/.test(url);
}

export function tweetsParsen(ausgabe: string): Tweet[] {
  const start = ausgabe.search(/[[{]/);
  if (start < 0) throw new Error('OpenCLI lieferte keine JSON-Ausgabe');
  const daten = JSON.parse(ausgabe.slice(start)) as TweetRoh[] | { ok?: boolean; error?: { message?: string } };
  if (!Array.isArray(daten)) {
    throw new Error(`OpenCLI-Fehler: ${daten.error?.message ?? 'unbekannt'} (Chrome offen und bei x.com eingeloggt?)`);
  }
  return daten
    .filter((t) => t.id && t.author && t.text && t.created_at)
    .map((t) => ({
      id: t.id!,
      autor: t.author!,
      text: t.text!.replace(/https:\/\/t\.co\/\S+/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT),
      zeit: new Date(t.created_at!).toISOString(),
      likes: t.likes ?? 0,
      url: `https://x.com/${t.author}/status/${t.id}`,
      posterUrl: t.media_posters?.[0],
      istVideo: istVideoUrl(t.media_urls?.[0]),
    }))
    .filter((t) => t.text.length > 0);
}

/** X-Suchanfrage: nur eigene Posts (keine Antworten/Retweets) der Konten seit dem Datum. */
export function kontenAbfrage(handles: string[], seitIso: string): string {
  const von = handles.map((h) => `from:${h}`).join(' OR ');
  return `since:${seitIso.slice(0, 10)} -filter:replies -filter:nativeretweets (${von})`;
}

export async function xTweetsSuchen(
  handles: string[],
  seitIso: string,
  ausfuehren: BefehlAusfuehren = opencliAusfuehren,
): Promise<Tweet[]> {
  const ausgabe = await ausfuehren(
    ['twitter', 'search', kontenAbfrage(handles, seitIso), '--product', 'live', '--limit', '40', '-f', 'json'],
    SUCH_TIMEOUT_MS,
  );
  return tweetsParsen(ausgabe).filter((t) => t.zeit >= seitIso);
}

/**
 * Tweets einer privaten X-Liste (für Seiten mit mehr Konten, als in eine from:-Suche passen).
 * Siehe konflikte.ts: Seite.listId.
 */
export async function xListeTweetsSuchen(
  listId: string,
  seitIso: string,
  ausfuehren: BefehlAusfuehren = opencliAusfuehren,
): Promise<Tweet[]> {
  const ausgabe = await ausfuehren(['twitter', 'list-tweets', listId, '--limit', '40', '-f', 'json'], SUCH_TIMEOUT_MS);
  // list-tweets liefert anders als die from:-Suche auch Retweets - eigene Aussage, keine Weiterverbreitung.
  return tweetsParsen(ausgabe).filter((t) => t.zeit >= seitIso && !/^RT @/.test(t.text));
}
