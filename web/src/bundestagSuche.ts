// Live-Themensuche im DIP des Bundestags (z. B. "Schuldenbremse"). Kostenlos, ohne Gemini.
// Sucht per Schlagwort (f.deskriptor) UND im Titel (f.titel), fuehrt beides zusammen.

const DIP_URL = 'https://search.dip.bundestag.de/api/v1/vorgang';
/** Oeffentlicher DIP-Schluessel (vom Bundestag veroeffentlicht, gueltig bis Ende Mai 2027) - wie in pipeline/src/bundestag/dipClient.ts. */
const DIP_KEY = 'R2BZaee.DjdCyihKZMf8AOjtScubP2EVydegzjmBIQ';
/** Einzelne schriftliche/muendliche Fragen von Abgeordneten bewusst weggelassen - zu viele, wenig Gehalt. */
const VORGANGSTYPEN = ['Gesetzgebung', 'Antrag', 'Kleine Anfrage', 'Große Anfrage'];
const MAX_TREFFER = 30;

export type SuchAmpel = 'beschlossen' | 'gescheitert' | 'gekippt' | 'in-beratung' | 'beantwortet';

export interface SuchTreffer {
  id: string;
  titel: string;
  typ: string;
  beratungsstand: string;
  ampel: SuchAmpel;
  initiative: string[];
  aktualisiert: string;
  link: string;
}

interface DipVorgang {
  id: string;
  titel: string;
  vorgangstyp?: string;
  beratungsstand?: string;
  initiative?: string[];
  aktualisiert: string;
}

const BESCHLOSSEN = ['Verkündet', 'Verabschiedet', 'Angenommen', 'Bundesrat hat zugestimmt', 'Bundesrat hat Vermittlungsausschuss nicht angerufen'];
const GESCHEITERT = ['Abgelehnt', 'Einbringung abgelehnt', 'Bundesrat hat Zustimmung versagt', 'Zurückgezogen', 'Für erledigt erklärt', 'Erledigt durch Ablauf der Wahlperiode'];

export function suchAmpel(stand: string): SuchAmpel {
  if (stand === 'Beantwortet') return 'beantwortet';
  if (BESCHLOSSEN.includes(stand)) return 'beschlossen';
  if (stand.startsWith('Für nichtig erklärt') || stand.startsWith('Für mit dem Grundgesetz unvereinbar')) return 'gekippt';
  if (GESCHEITERT.includes(stand)) return 'gescheitert';
  return 'in-beratung';
}

async function dipAbfrage(filter: 'f.deskriptor' | 'f.titel', begriff: string, fetchImpl: typeof fetch): Promise<DipVorgang[]> {
  const params = new URLSearchParams({ format: 'json', [filter]: begriff });
  for (const typ of VORGANGSTYPEN) params.append('f.vorgangstyp', typ);
  const antwort = await fetchImpl(`${DIP_URL}?${params}`, { headers: { Authorization: `ApiKey ${DIP_KEY}` } });
  if (!antwort.ok) throw new Error(`DIP antwortete mit Status ${antwort.status}`);
  return ((await antwort.json()) as { documents?: DipVorgang[] }).documents ?? [];
}

export async function bundestagSuchen(begriff: string, fetchImpl: typeof fetch = fetch): Promise<SuchTreffer[]> {
  const [perSchlagwort, perTitel] = await Promise.all([
    dipAbfrage('f.deskriptor', begriff, fetchImpl),
    dipAbfrage('f.titel', begriff, fetchImpl),
  ]);
  const nachId = new Map<string, DipVorgang>();
  for (const v of [...perSchlagwort, ...perTitel]) nachId.set(v.id, v);
  return [...nachId.values()]
    .sort((a, b) => b.aktualisiert.localeCompare(a.aktualisiert))
    .slice(0, MAX_TREFFER)
    .map((v) => {
      const stand = v.beratungsstand ?? 'Unbekannt';
      return {
        id: v.id,
        titel: v.titel,
        typ: v.vorgangstyp ?? 'Vorgang',
        beratungsstand: stand,
        ampel: suchAmpel(stand),
        initiative: v.initiative ?? [],
        aktualisiert: v.aktualisiert,
        link: `https://dip.bundestag.de/vorgang/-/${v.id}`,
      };
    });
}

/** /api/bundestag/suche?q=... - Antwort 1 h im Cloudflare-Cache, um die DIP-API zu schonen. */
/** Im Worker darf fetch nicht losgeloest weitergereicht werden ("internal error") - daher als Wrapper. */
const globalesFetch: typeof fetch = (input, init) => fetch(input, init);

export async function bundestagSucheAntwort(request: Request, fetchImpl: typeof fetch = globalesFetch): Promise<Response> {
  const begriff = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (begriff.length < 3 || begriff.length > 60) {
    return new Response('Suchbegriff muss 3 bis 60 Zeichen lang sein', { status: 400 });
  }

  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : undefined;
  const cacheKey = new Request(`https://cache.newsspur.de/bundestag-suche?q=${encodeURIComponent(begriff.toLowerCase())}`);
  const gecacht = await cache?.match(cacheKey);
  if (gecacht) return gecacht;

  let treffer: SuchTreffer[];
  try {
    treffer = await bundestagSuchen(begriff, fetchImpl);
  } catch (fehler) {
    console.error('Bundestag-Suche fehlgeschlagen:', fehler);
    return new Response('Bundestag-Datenbank gerade nicht erreichbar', { status: 502 });
  }
  const antwort = Response.json({ begriff, treffer }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  await cache?.put(cacheKey, antwort.clone());
  return antwort;
}
