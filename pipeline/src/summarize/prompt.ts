import type { Artikel } from '../types.js';

export const ZUSAMMENFASSUNGS_SCHEMA = {
  type: 'object',
  properties: {
    schlagzeile: { type: 'string' },
    zusammenfassung: { type: 'string' },
    kategorieWerte: {
      type: 'object',
      properties: {
        deutschland: { type: 'number' },
        tuerkei: { type: 'number' },
        nahost: { type: 'number' },
      },
      required: ['deutschland', 'tuerkei', 'nahost'],
    },
    wichtigkeit: { type: 'number' },
    wichtigkeitBegruendung: { type: 'string' },
    fakten: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          belegtDurch: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'belegtDurch'],
      },
    },
    strittigePunkte: { type: 'array', items: { type: 'string' } },
    sicherheit: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] },
  },
  required: [
    'schlagzeile', 'zusammenfassung', 'kategorieWerte', 'wichtigkeit',
    'wichtigkeitBegruendung', 'fakten', 'strittigePunkte', 'sicherheit',
  ],
};

export function promptErstellen(artikel: Artikel[]): string {
  const quellenBlock = artikel
    .map(
      (a, i) => `Quelle ${i + 1} (Kennung: "${a.quelle.id}", Verlag: ${a.quelle.name}, Typ: ${a.quelle.typ}):
Schlagzeile: ${a.titel}
Anriss: ${a.teaser}
Veroeffentlicht: ${a.veroeffentlichtAm}`,
    )
    .join('\n\n');

  return `Du bist Redaktions-Assistent einer deutschen Nachrichten-App. Fasse das folgende Ereignis ausschliesslich auf Basis der untenstehenden Quellen zusammen.

STRENGE REGELN:
- Verwende NUR Informationen, die woertlich oder sinngemaess in den Quellen stehen. Erfinde keine Namen, Zahlen oder Daten.
- Wenn die Quellen fuer eine Aussage nicht ausreichen, schreibe das explizit statt zu raten.
- Wenn sich Quellen bei einer Angabe widersprechen, liste das unter "strittigePunkte" auf und formuliere die Zusammenfassung als "laut [Verlag] ... / laut [Verlag] ...".
- Jeder Eintrag in "fakten" muss im Feld "belegtDurch" die Kennung(en) der Quelle(n) enthalten, die genau diesen Fakt stuetzen. Nutze ausschliesslich die oben angegebenen Kennungen.
- Bewerte "kategorieWerte" fuer alle drei Kategorien unabhaengig (0-100): deutschland, tuerkei, nahost. Ein Ereignis kann fuer mehrere gleichzeitig relevant sein.
- Neutraler, sachlicher Ton. Keine eigene Wertung, kein Clickbait.
- Antworte auf Deutsch, auch wenn die Quellen in einer anderen Sprache sind.

QUELLEN:

${quellenBlock}`;
}
