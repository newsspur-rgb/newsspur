import type { Thema } from '../types.js';

export type Unabhaengigkeitsergebnis =
  | { status: 'ausreichend' }
  | { status: 'schwach'; grund: string }
  | { status: 'unzureichend'; grund: string };

const AGENTUR_MUSTER = /\((dpa|reuters|afp|ap|aa|anadolu|epd|kna)\)/i;

function agenturCredit(teaser: string): string | null {
  const treffer = teaser.match(AGENTUR_MUSTER);
  return treffer ? treffer[1].toLowerCase() : null;
}

export function unabhaengigkeitPruefen(thema: Thema): Unabhaengigkeitsergebnis {
  const verlage = new Set(thema.artikel.map((a) => a.quelle.id));
  if (verlage.size < 2) {
    return { status: 'unzureichend', grund: `Nur ${verlage.size} Quelle(n) berichten bisher.` };
  }

  const credits = thema.artikel.map((a) => agenturCredit(a.teaser));
  const alleGleicheAgentur = credits.every((c) => c !== null) && new Set(credits).size === 1;
  if (alleGleicheAgentur) {
    return { status: 'schwach', grund: `Alle Quellen berufen sich auf dieselbe Agentur (${credits[0]}).` };
  }

  return { status: 'ausreichend' };
}
