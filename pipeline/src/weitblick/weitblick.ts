import type { ThemenStore } from '../store/store.js';
import type { BundestagStore } from '../bundestag/bundestagStore.js';
import type { GeminiClient } from '../summarize/geminiClient.js';
import type { VerarbeitetesThema } from '../types.js';
import type { WeltArtikel } from './gdeltWelt.js';
import { neutraleLaenderFuer, type Kategorie, type NeutralesLand } from './neutraleLaender.js';
import type { SprachStimmung, StimmungsTon, Weitblick, WeitblickEntwicklung, Weltblick, WeltUrteil } from './typen.js';
import { ALLE_SPRACHEN, type SprachraumPosts } from './bluesky.js';

const KATEGORIEN: Kategorie[] = ['deutschland', 'tuerkei', 'nahost'];
/** Unter so vielen verschiedenen Laendern gilt ein Thema als "kaum berichtet" - kein Abgleich moeglich. */
export const MIN_LAENDER = 3;
const MAX_EINGABE_THEMEN = 25;

export type WeltSuche = (suchbegriffe: string[], laender: NeutralesLand[]) => Promise<WeltArtikel[]>;
export type StimmenSuche = (suchbegriffe: string[], uebersetzt: Record<string, string>, seitIso: string) => Promise<SprachraumPosts[]>;

export interface WeitblickStore {
  speichern(weitblick: Weitblick): Promise<void>;
}

export interface WeitblickAbhaengigkeiten {
  themenStore: ThemenStore;
  bundestagStore?: BundestagStore;
  geminiClient: GeminiClient;
  weltSuche: WeltSuche;
  /** Bluesky-Stimmung nach Sprache - optional, ohne sie entfaellt nur dieser Teil. */
  stimmenSuche?: StimmenSuche;
  weitblickStore: WeitblickStore;
  /** Pause zwischen GDELT-Abfragen (GDELT erlaubt max. 1 Abfrage pro 5 s). */
  pauseMs?: number;
  jetzt?: Date;
}

/** ISO-8601-Kalenderwoche, z. B. "2026-W42". */
export function isoWoche(datum: Date): string {
  const d = new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
  const wochentag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - wochentag);
  const jahresanfang = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const woche = Math.ceil(((d.getTime() - jahresanfang.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(woche).padStart(2, '0')}`;
}

function hauptKategorie(t: VerarbeitetesThema): Kategorie {
  const kw = t.zusammenfassung!.kategorieWerte;
  return KATEGORIEN.reduce((beste, k) => (kw[k] > kw[beste] ? k : beste), 'deutschland' as Kategorie);
}

/** Wichtigste veroeffentlichte Themen der Woche, doppelte Schlagzeilen entfernt. */
export function wochenThemen(alle: VerarbeitetesThema[]): VerarbeitetesThema[] {
  const gesehen = new Set<string>();
  return alle
    .filter((t) => t.status === 'veroeffentlicht' && t.zusammenfassung)
    .sort((a, b) => b.zusammenfassung!.wichtigkeit - a.zusammenfassung!.wichtigkeit)
    .filter((t) => {
      const schluessel = t.zusammenfassung!.schlagzeile.toLowerCase();
      if (gesehen.has(schluessel)) return false;
      gesehen.add(schluessel);
      return true;
    })
    .slice(0, MAX_EINGABE_THEMEN);
}

// ---------- Schritt 1: Entwicklungen der Woche auswaehlen ----------

export const AUSWAHL_SCHEMA = {
  type: 'object',
  properties: {
    einleitung: { type: 'string' },
    entwicklungen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titel: { type: 'string' },
          kategorie: { type: 'string', enum: KATEGORIEN },
          kurz: { type: 'string' },
          themaIds: { type: 'array', items: { type: 'string' } },
          suchbegriffe: { type: 'array', items: { type: 'string' } },
          uebersetzteSuche: {
            type: 'array',
            items: {
              type: 'object',
              properties: { sprache: { type: 'string', enum: ALLE_SPRACHEN }, suchtext: { type: 'string' } },
              required: ['sprache', 'suchtext'],
            },
          },
        },
        required: ['titel', 'kategorie', 'kurz', 'themaIds', 'suchbegriffe', 'uebersetzteSuche'],
      },
    },
  },
  required: ['einleitung', 'entwicklungen'],
};

export function auswahlPromptErstellen(themen: VerarbeitetesThema[]): string {
  const block = themen
    .map((t) => {
      const z = t.zusammenfassung!;
      return `Meldung (Kennung: "${t.thema.id}", Bereich: ${hauptKategorie(t)}, Wichtigkeit ${z.wichtigkeit}):
${z.schlagzeile}
${z.zusammenfassung}`;
    })
    .join('\n\n');

  return `Du bist Chefredakteur einer neutralen deutschen Nachrichten-App und schreibst den Wochenrueckblick "Weitblick".

AUFGABE:
- Waehle aus den Meldungen der Woche die 5 wichtigsten ENTWICKLUNGEN. Meldungen zum selben Vorgang fasst du zu einer Entwicklung zusammen.
- "einleitung": 1-2 Saetze, was diese Woche praegte.
- Je Entwicklung:
  - "titel": max. 10 Woerter
  - "kategorie": deutschland, tuerkei oder nahost
  - "kurz": hoechstens 5 kurze Zeilen - was ist passiert, nur aus den Meldungen
  - "themaIds": Kennungen der zugrunde liegenden Meldungen (nur die oben angegebenen)
  - "suchbegriffe": 2-3 ENGLISCHE Stichwoerter (Namen, Orte, Schluesselbegriff), mit denen man die Entwicklung in der Weltpresse findet, z. B. ["Merz", "Ukraine", "visit"]
  - "uebersetzteSuche": fuer JEDE dieser Sprachen (${ALLE_SPRACHEN.join(', ')}) ein Eintrag mit "suchtext" = dieselben 2 wichtigsten Stichwoerter so, wie man sie in dieser Sprache und Schrift schreibt (z. B. ar: "ميرتس أوكرانيا", ru: "Мерц Украина", zh: "默茨 乌克兰"). Nur die Stichwoerter, kein Satz.

STRENGE REGELN:
- Nur Informationen aus den Meldungen. Nichts erfinden.
- Neutral und sachlich, keine Wertung.
- Antworte auf Deutsch (ausser "suchbegriffe").

MELDUNGEN DER WOCHE:

${block}`;
}

interface AuswahlRoh {
  einleitung: string;
  entwicklungen: Array<{
    titel: string;
    kategorie: Kategorie;
    kurz: string;
    themaIds: string[];
    suchbegriffe: string[];
    uebersetzteSuche?: Array<{ sprache: string; suchtext: string }>;
  }>;
}

function istAuswahl(wert: unknown): wert is AuswahlRoh {
  if (typeof wert !== 'object' || wert === null) return false;
  const w = wert as Record<string, unknown>;
  return (
    typeof w.einleitung === 'string' &&
    Array.isArray(w.entwicklungen) &&
    w.entwicklungen.every(
      (e: any) =>
        typeof e?.titel === 'string' &&
        KATEGORIEN.includes(e?.kategorie) &&
        typeof e?.kurz === 'string' &&
        Array.isArray(e?.themaIds) &&
        Array.isArray(e?.suchbegriffe) &&
        e.suchbegriffe.length > 0 &&
        e.suchbegriffe.every((s: unknown) => typeof s === 'string'),
    )
  );
}

// ---------- Schritt 2: Abgleich mit der neutralen Weltpresse (Salims Methode) ----------

export const ABGLEICH_SCHEMA = {
  type: 'object',
  properties: {
    bewertungen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nummer: { type: 'number' },
          urteil: { type: 'string', enum: ['deckungsgleich', 'teilweise', 'widerspruechlich'] },
          uebereinstimmung: { type: 'string' },
          abweichungen: { type: 'array', items: { type: 'string' } },
        },
        required: ['nummer', 'urteil', 'uebereinstimmung', 'abweichungen'],
      },
    },
  },
  required: ['bewertungen'],
};

export function abgleichPromptErstellen(
  faelle: Array<{ nummer: number; titel: string; kurz: string; artikel: WeltArtikel[] }>,
): string {
  const block = faelle
    .map((f) => {
      const zeilen = f.artikel.map((a) => `- [${a.land}, ${a.medium}] ${a.titel}`).join('\n');
      return `FALL ${f.nummer}: ${f.titel}
Unsere Kurzfassung: ${f.kurz}
Schlagzeilen aus neutralen Laendern:
${zeilen}`;
    })
    .join('\n\n');

  return `Du pruefst Nachrichten nach folgender Methode: Man liest, was Medien aus weit entfernten Laendern OHNE eigenes Interesse am Ereignis berichten, und schaut, wo sie UEBEREINSTIMMEN. Nur was viele unabhaengig voneinander gleich berichten, gilt als gesichert.

AUFGABE je Fall (Feld "nummer" = Fallnummer):
- "uebereinstimmung": hoechstens 5 kurze Zeilen - was die Schlagzeilen aus MEHREREN Laendern uebereinstimmend berichten. Nenne, aus wie vielen Laendern.
- "abweichungen": wo einzelne Laender anders berichten oder unsere Kurzfassung NICHT gedeckt ist (leer, wenn keine). Land nennen.
- "urteil": "deckungsgleich" (Weltpresse bestaetigt unsere Kurzfassung im Kern), "teilweise" (nur Teile bestaetigt oder anderer Schwerpunkt), "widerspruechlich" (Weltpresse berichtet im Kern anders).

STRENGE REGELN:
- Nur die angegebenen Schlagzeilen verwenden. Es sind nur Ueberschriften - keine Details hineininterpretieren.
- Schlagzeilen, die erkennbar zu einem anderen Ereignis gehoeren, ignorieren.
- Neutral, keine Wertung. Antworte auf Deutsch.

${block}`;
}

interface AbgleichRoh {
  bewertungen: Array<{ nummer: number; urteil: Exclude<WeltUrteil, 'kaum-berichtet'>; uebereinstimmung: string; abweichungen: string[] }>;
}

function istAbgleich(wert: unknown): wert is AbgleichRoh {
  if (typeof wert !== 'object' || wert === null) return false;
  const w = wert as Record<string, unknown>;
  return (
    Array.isArray(w.bewertungen) &&
    w.bewertungen.every(
      (b: any) =>
        typeof b?.nummer === 'number' &&
        ['deckungsgleich', 'teilweise', 'widerspruechlich'].includes(b?.urteil) &&
        typeof b?.uebereinstimmung === 'string' &&
        Array.isArray(b?.abweichungen),
    )
  );
}

// ---------- Schritt 3: Bluesky-Stimmung nach Sprachraum ----------

const TOENE: StimmungsTon[] = ['zustimmend', 'ablehnend', 'gemischt', 'neutral'];

export const STIMMUNG_SCHEMA = {
  type: 'object',
  properties: {
    stimmungen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nummer: { type: 'number' },
          sprachraum: { type: 'string' },
          passendePosts: { type: 'number' },
          zusammenfassung: { type: 'string' },
          ton: { type: 'string', enum: TOENE },
        },
        required: ['nummer', 'sprachraum', 'passendePosts', 'zusammenfassung', 'ton'],
      },
    },
  },
  required: ['stimmungen'],
};

export function stimmungPromptErstellen(faelle: Array<{ nummer: number; titel: string; raeume: SprachraumPosts[] }>): string {
  const block = faelle
    .map((f) => {
      const raeume = f.raeume
        .map((r) => `  Sprachraum "${r.sprachraum}":\n${r.posts.map((p) => `   - ${p.text}`).join('\n')}`)
        .join('\n');
      return `FALL ${f.nummer}: ${f.titel}\n${raeume}`;
    })
    .join('\n\n');

  return `Du wertest oeffentliche Bluesky-Posts aus, um die Stimmung in verschiedenen Sprachraeumen zu einem Ereignis zu beschreiben.

AUFGABE: Je Fall und Sprachraum ein Eintrag (Feld "nummer" = Fallnummer, "sprachraum" exakt wie angegeben):
- "passendePosts": wie viele der Posts sich wirklich auf DIESES Ereignis beziehen. Posts zu anderen Themen oder in einer offensichtlich anderen Sprache nicht mitzaehlen.
- "zusammenfassung": 1-2 Saetze, welche Haltung/Sorge/Reaktion in den passenden Posts ueberwiegt. Beginne mit "Auf Bluesky ...". Bei 0 passenden Posts: "Keine passenden Posts."
- "ton": zustimmend, ablehnend, gemischt oder neutral - gegenueber dem Ereignis bzw. den Handelnden.

STRENGE REGELN:
- Nur aus den Posts ableiten, nichts hinzuerfinden. Keine Namen von Privatpersonen nennen.
- Sachlich wiedergeben, nicht werten. Beleidigungen nicht zitieren.
- Antworte auf Deutsch.

${block}`;
}

interface StimmungRoh {
  stimmungen: Array<{ nummer: number; sprachraum: string; passendePosts: number; zusammenfassung: string; ton: StimmungsTon }>;
}

function istStimmung(wert: unknown): wert is StimmungRoh {
  if (typeof wert !== 'object' || wert === null) return false;
  const w = wert as Record<string, unknown>;
  return (
    Array.isArray(w.stimmungen) &&
    w.stimmungen.every(
      (s: any) =>
        typeof s?.nummer === 'number' &&
        typeof s?.sprachraum === 'string' &&
        typeof s?.passendePosts === 'number' &&
        typeof s?.zusammenfassung === 'string' &&
        TOENE.includes(s?.ton),
    )
  );
}

/** Ein Gemini-Aufruf fuer alle Entwicklungen; Sprachraeume mit zu wenig passenden Posts fallen raus. */
async function stimmungenBewerten(
  faelle: Array<{ nummer: number; titel: string; raeume: SprachraumPosts[] }>,
  client: GeminiClient,
): Promise<Map<number, SprachStimmung[]>> {
  const ergebnis = new Map<number, SprachStimmung[]>();
  const mitPosts = faelle.filter((f) => f.raeume.length > 0);
  if (mitPosts.length === 0) return ergebnis;

  const roh = await client.strukturierteAntwort(stimmungPromptErstellen(mitPosts), STIMMUNG_SCHEMA);
  if (!istStimmung(roh)) throw new Error('Gemini-Antwort hat nicht die erwartete Form (ungueltige Stimmung)');

  for (const s of roh.stimmungen) {
    const raum = mitPosts.find((f) => f.nummer === s.nummer)?.raeume.find((r) => r.sprachraum === s.sprachraum);
    if (!raum || s.passendePosts < MIN_PASSENDE_POSTS) continue;
    const liste = ergebnis.get(s.nummer) ?? [];
    liste.push({
      sprachraum: s.sprachraum,
      anzahlPosts: s.passendePosts,
      zusammenfassung: s.zusammenfassung,
      ton: s.ton,
      beispiele: raum.posts.slice(0, 2),
    });
    ergebnis.set(s.nummer, liste);
  }
  return ergebnis;
}

/** Mindestens so viele Posts muessen laut Gemini wirklich zum Ereignis passen. */
export const MIN_PASSENDE_POSTS = 2;

function kaumBerichtet(artikel: WeltArtikel[]): Weltblick {
  const laender = [...new Set(artikel.map((a) => a.land))];
  return {
    urteil: 'kaum-berichtet',
    laender,
    uebereinstimmung:
      laender.length === 0
        ? 'Keine Berichte aus neutralen Ländern gefunden.'
        : `Nur aus ${laender.length} neutralen ${laender.length === 1 ? 'Land' : 'Ländern'} berichtet – zu wenig für einen Abgleich.`,
    abweichungen: [],
    belege: artikel,
  };
}

const warten = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wochenrueckblick: 2 Gemini-Aufrufe + bis zu 5 GDELT-Abfragen. */
export async function weitblickErstellen(deps: WeitblickAbhaengigkeiten): Promise<Weitblick> {
  const jetzt = deps.jetzt ?? new Date();
  const von = new Date(jetzt.getTime() - 7 * 86_400_000).toISOString();
  const pauseMs = deps.pauseMs ?? 10_000;

  const themen = wochenThemen(await deps.themenStore.neuereAls(von));
  if (themen.length === 0) throw new Error('Keine veroeffentlichten Meldungen in den letzten 7 Tagen');
  const bekannteIds = new Set(themen.map((t) => t.thema.id));

  const auswahl = await deps.geminiClient.strukturierteAntwort(auswahlPromptErstellen(themen), AUSWAHL_SCHEMA);
  if (!istAuswahl(auswahl)) throw new Error('Gemini-Antwort hat nicht die erwartete Form (ungueltige Weitblick-Auswahl)');
  const entwicklungenRoh = auswahl.entwicklungen.slice(0, 5);

  // Weltpresse je Entwicklung - nacheinander mit Pause, GDELT drosselt sonst (429).
  const weltArtikel: WeltArtikel[][] = [];
  for (const [i, e] of entwicklungenRoh.entries()) {
    if (i > 0) await warten(pauseMs);
    try {
      weltArtikel.push(await deps.weltSuche(e.suchbegriffe.slice(0, 3), neutraleLaenderFuer(e.kategorie)));
    } catch (fehlerUrsache) {
      console.warn(`Weltpresse-Suche fuer "${e.titel}" fehlgeschlagen:`, fehlerUrsache);
      weltArtikel.push([]);
    }
  }

  const faelle = entwicklungenRoh
    .map((e, i) => ({ nummer: i + 1, titel: e.titel, kurz: e.kurz, artikel: weltArtikel[i] }))
    .filter((f) => new Set(f.artikel.map((a) => a.land)).size >= MIN_LAENDER);

  const bewertungen = new Map<number, AbgleichRoh['bewertungen'][number]>();
  if (faelle.length > 0) {
    const abgleich = await deps.geminiClient.strukturierteAntwort(abgleichPromptErstellen(faelle), ABGLEICH_SCHEMA);
    if (!istAbgleich(abgleich)) throw new Error('Gemini-Antwort hat nicht die erwartete Form (ungueltiger Weltpresse-Abgleich)');
    for (const b of abgleich.bewertungen) bewertungen.set(b.nummer, b);
  }

  // Bluesky-Stimmung: eigener Gemini-Aufruf - scheitert er, bleibt der Rest des Weitblicks erhalten.
  let stimmungen = new Map<number, SprachStimmung[]>();
  if (deps.stimmenSuche) {
    try {
      const faelleStimmung = [];
      for (const [i, e] of entwicklungenRoh.entries()) {
        const uebersetzt = Object.fromEntries(
          (Array.isArray(e.uebersetzteSuche) ? e.uebersetzteSuche : [])
            .filter((u) => typeof u?.sprache === 'string' && typeof u?.suchtext === 'string')
            .map((u) => [u.sprache, u.suchtext]),
        );
        faelleStimmung.push({ nummer: i + 1, titel: e.titel, raeume: await deps.stimmenSuche(e.suchbegriffe.slice(0, 3), uebersetzt, von) });
      }
      stimmungen = await stimmungenBewerten(faelleStimmung, deps.geminiClient);
    } catch (fehlerUrsache) {
      console.warn('Bluesky-Stimmung uebersprungen:', fehlerUrsache);
    }
  }

  const entwicklungen: WeitblickEntwicklung[] = entwicklungenRoh.map((e, i) => {
    const artikel = weltArtikel[i];
    const b = bewertungen.get(i + 1);
    const weltblick: Weltblick = b
      ? {
          urteil: b.urteil,
          laender: [...new Set(artikel.map((a) => a.land))],
          uebereinstimmung: b.uebereinstimmung,
          abweichungen: b.abweichungen,
          belege: artikel,
        }
      : kaumBerichtet(artikel);
    return {
      titel: e.titel,
      kategorie: e.kategorie,
      kurz: e.kurz,
      themaIds: e.themaIds.filter((id) => bekannteIds.has(id)),
      weltblick,
      stimmung: stimmungen.get(i + 1) ?? [],
    };
  });

  const gesetze = deps.bundestagStore
    ? (await deps.bundestagStore.gesetzeSeit(von)).filter((g) => g.ampel !== 'in-beratung')
    : [];

  const weitblick: Weitblick = {
    woche: isoWoche(jetzt),
    von,
    bis: jetzt.toISOString(),
    erstellt: jetzt.toISOString(),
    einleitung: auswahl.einleitung,
    entwicklungen,
    gesetze,
  };
  await deps.weitblickStore.speichern(weitblick);
  return weitblick;
}
