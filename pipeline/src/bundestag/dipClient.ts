import type { Gesetz, Plenarprotokoll } from './typen.js';
import { ampelFuerStand } from './status.js';

const DIP_BASIS_URL = 'https://search.dip.bundestag.de/api/v1';

/** Oeffentlicher DIP-Schluessel, vom Bundestag selbst auf dip.bundestag.de/über-dip/hilfe/api
 *  veroeffentlicht (gueltig bis Ende Mai 2027). Per DIP_API_KEY ueberschreibbar. */
export const OEFFENTLICHER_DIP_KEY = 'R2BZaee.DjdCyihKZMf8AOjtScubP2EVydegzjmBIQ';

interface DipVorgangRoh {
  id: string;
  titel: string;
  abstract?: string;
  beratungsstand?: string;
  initiative?: string[];
  sachgebiet?: string[];
  datum?: string;
  aktualisiert: string;
  verkuendung?: Array<{ verkuendungsdatum?: string }>;
}

interface DipProtokollRoh {
  id: string;
  titel: string;
  datum: string;
  text?: string;
}

interface DipListe<T> {
  numFound: number;
  cursor?: string;
  documents: T[];
}

export interface DipClient {
  /** Gesetzgebungs-Vorgaenge, die seit `seitIso` aktualisiert wurden (max. `maxSeiten` x 100). */
  gesetzeSeit(seitIso: string, maxSeiten?: number): Promise<Gesetz[]>;
  /** Die neuesten Bundestags-Plenarprotokolle, die bereits Volltext haben. */
  neuesteProtokolle(): Promise<Plenarprotokoll[]>;
}

export function vorgangZuGesetz(v: DipVorgangRoh): Gesetz {
  const stand = v.beratungsstand ?? 'Unbekannt';
  return {
    id: v.id,
    titel: v.titel,
    // DIP liefert teils HTML-Reste wie "<strong>" im Abstract
    abstract: v.abstract?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || undefined,
    beratungsstand: stand,
    ampel: ampelFuerStand(stand),
    initiative: v.initiative ?? [],
    sachgebiet: v.sachgebiet ?? [],
    datum: v.datum,
    verkuendetAm: v.verkuendung?.[0]?.verkuendungsdatum,
    aktualisiert: v.aktualisiert,
    link: `https://dip.bundestag.de/vorgang/-/${v.id}`,
  };
}

export function erstelleDipClient(apiKey: string = OEFFENTLICHER_DIP_KEY, fetchImpl: typeof fetch = fetch): DipClient {
  async function holen<T>(pfad: string, params: Record<string, string>): Promise<DipListe<T>> {
    const query = new URLSearchParams({ ...params, format: 'json' });
    const antwort = await fetchImpl(`${DIP_BASIS_URL}/${pfad}?${query}`, {
      headers: { Authorization: `ApiKey ${apiKey}` },
    });
    if (!antwort.ok) {
      throw new Error(`DIP antwortete mit Status ${antwort.status}`);
    }
    return (await antwort.json()) as DipListe<T>;
  }

  return {
    async gesetzeSeit(seitIso, maxSeiten = 3) {
      const gesetze: Gesetz[] = [];
      let cursor: string | undefined;
      for (let seite = 0; seite < maxSeiten; seite++) {
        const params: Record<string, string> = {
          'f.vorgangstyp': 'Gesetzgebung',
          'f.aktualisiert.start': seitIso.slice(0, 19),
        };
        if (cursor) params.cursor = cursor;
        const liste = await holen<DipVorgangRoh>('vorgang', params);
        gesetze.push(...liste.documents.map(vorgangZuGesetz));
        // DIP liefert denselben Cursor zurueck, wenn keine weiteren Seiten existieren.
        if (!liste.cursor || liste.cursor === cursor || liste.documents.length === 0) break;
        cursor = liste.cursor;
      }
      return gesetze;
    },

    async neuesteProtokolle() {
      const liste = await holen<DipProtokollRoh>('plenarprotokoll-text', { 'f.zuordnung': 'BT' });
      return liste.documents
        .filter((p) => typeof p.text === 'string' && p.text.length > 0)
        .map((p) => ({ id: p.id, titel: p.titel, datum: p.datum, text: p.text as string }));
    },
  };
}
