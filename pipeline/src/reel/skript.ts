import type { ThemenZusammenfassung } from '../types.js';

const SPRECHTEXT_MAX_ZEICHEN = 400; // ~ 20 Sekunden bei Piper-Sprechtempo

/** Baut einen kurzen Sprechtext aus Schlagzeile + den ersten Kernsaetzen der Zusammenfassung. */
export function sprechtextErstellen(zusammenfassung: ThemenZusammenfassung): string {
  const saetze = zusammenfassung.zusammenfassung.split(/(?<=[.!?])\s+/).filter(Boolean);
  const teile = [zusammenfassung.schlagzeile + '.'];
  let laenge = teile[0].length;
  for (const satz of saetze) {
    if (laenge + satz.length + 1 > SPRECHTEXT_MAX_ZEICHEN) break;
    teile.push(satz);
    laenge += satz.length + 1;
  }
  return teile.join(' ');
}
