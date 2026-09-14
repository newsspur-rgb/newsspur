// Grob geschaetzt (wie push/auswahl.ts) - noch keine echte Wichtigkeits-Verteilung aus Live-Laeufen bekannt.
export const REEL_WICHTIGKEIT_SCHWELLE = 70;

/** Reine Auswahl-Regel: Reel nur bei ausreichender Wichtigkeit UND wenn heute noch keines gesendet wurde. */
export function sollReelWerden(wichtigkeit: number, bereitsHeuteGesendet: boolean): boolean {
  return !bereitsHeuteGesendet && wichtigkeit >= REEL_WICHTIGKEIT_SCHWELLE;
}
