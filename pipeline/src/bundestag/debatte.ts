import type { GeminiClient } from '../summarize/geminiClient.js';
import type { Debatte, DebattenPunkt, Plenarprotokoll } from './typen.js';

/** ca. 100k Tokens - haelt das knappe Gemini-Kontingent ein (ein volles Protokoll hat bis ~900k Zeichen). */
export const MAX_PROTOKOLL_ZEICHEN = 400_000;
const MAX_INHALT_ZEICHEN = 12_000;

export const DEBATTEN_SCHEMA = {
  type: 'object',
  properties: {
    ueberblick: { type: 'string' },
    punkte: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          thema: { type: 'string' },
          worum: { type: 'string' },
          positionen: {
            type: 'array',
            items: {
              type: 'object',
              properties: { fraktion: { type: 'string' }, aussage: { type: 'string' } },
              required: ['fraktion', 'aussage'],
            },
          },
          ergebnis: { type: 'string' },
        },
        required: ['thema', 'worum', 'positionen', 'ergebnis'],
      },
    },
  },
  required: ['ueberblick', 'punkte'],
};

/** Kuerzt das Protokoll: kurzes Inhaltsverzeichnis + Sitzungsverlauf ab "Beginn:", gedeckelt auf MAX_PROTOKOLL_ZEICHEN. */
export function protokollKuerzen(text: string): { text: string; gekuerzt: boolean } {
  const beginn = text.search(/^\(?Beginn:\s*\d/m);
  let gekuerzt = false;
  let ergebnis = text;
  if (beginn > MAX_INHALT_ZEICHEN) {
    ergebnis = `${text.slice(0, MAX_INHALT_ZEICHEN)}\n[... Inhaltsverzeichnis gekuerzt ...]\n${text.slice(beginn)}`;
  }
  if (ergebnis.length > MAX_PROTOKOLL_ZEICHEN) {
    ergebnis = ergebnis.slice(0, MAX_PROTOKOLL_ZEICHEN);
    gekuerzt = true;
  }
  return { text: ergebnis, gekuerzt };
}

export function debattenPromptErstellen(protokoll: Plenarprotokoll, text: string): string {
  return `Du bist Parlaments-Redakteur einer neutralen deutschen Nachrichten-App. Unten steht das amtliche Plenarprotokoll "${protokoll.titel}" vom ${protokoll.datum}.

AUFGABE:
- "ueberblick": 2-3 Saetze, worum es in der Sitzung hauptsaechlich ging.
- "punkte": die 3 bis 6 wichtigsten Tagesordnungspunkte (nach politischer Bedeutung, nicht nach Reihenfolge). Reine Formalien (Wahlen in Gremien, Geschaeftsordnung) weglassen.
  - "thema": kurzer Titel (max. 8 Woerter)
  - "worum": 1-2 Saetze, worum es geht
  - "positionen": je Fraktion, die gesprochen hat, ihre Kernaussage in einem Satz (Fraktion so benennen, wie sie im Protokoll steht, z. B. "CDU/CSU", "SPD", "AfD", "BÜNDNIS 90/DIE GRÜNEN", "Die Linke", oder "Bundesregierung")
  - "ergebnis": Abstimmungsergebnis, Ueberweisung an Ausschuss o. ae. - laut Protokoll. Wenn nicht erkennbar: "Im Protokollauszug nicht erkennbar".

STRENGE REGELN:
- Nur was im Protokoll steht. Nichts erfinden, keine Zahlen raten.
- Alle Fraktionen gleich fair und sachlich wiedergeben, keine eigene Wertung.
- Antworte auf Deutsch.

PROTOKOLL:

${text}`;
}

function istGueltig(wert: unknown): wert is { ueberblick: string; punkte: DebattenPunkt[] } {
  if (typeof wert !== 'object' || wert === null) return false;
  const w = wert as Record<string, unknown>;
  return (
    typeof w.ueberblick === 'string' &&
    Array.isArray(w.punkte) &&
    w.punkte.every(
      (p: any) =>
        typeof p?.thema === 'string' &&
        typeof p?.worum === 'string' &&
        typeof p?.ergebnis === 'string' &&
        Array.isArray(p?.positionen) &&
        p.positionen.every((x: any) => typeof x?.fraktion === 'string' && typeof x?.aussage === 'string'),
    )
  );
}

export async function debatteZusammenfassen(protokoll: Plenarprotokoll, client: GeminiClient): Promise<Debatte> {
  const { text, gekuerzt } = protokollKuerzen(protokoll.text);
  const roh = await client.strukturierteAntwort(debattenPromptErstellen(protokoll, text), DEBATTEN_SCHEMA);
  if (!istGueltig(roh)) {
    throw new Error('Gemini-Antwort hat nicht die erwartete Form (ungueltige Debatten-Zusammenfassung)');
  }
  return {
    id: protokoll.id,
    titel: protokoll.titel,
    datum: protokoll.datum,
    ueberblick: roh.ueberblick,
    punkte: roh.punkte,
    link: `https://dip.bundestag.de/plenarprotokoll/-/${protokoll.id}`,
    gekuerzt,
  };
}
