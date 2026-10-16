import type { GesetzAmpel } from './typen.js';

// Werte aus dem DIP-Feld "beratungsstand" (Stand 2026-10, aus WP 20 gezaehlt).
// "Vermittlungsausschuss nicht angerufen" = Einspruchsgesetz hat den Bundesrat passiert, wartet nur noch auf Verkuendung.
const BESCHLOSSEN = ['Verkündet', 'Verabschiedet','Bundesrat hat zugestimmt', 'Bundesrat hat Vermittlungsausschuss nicht angerufen', 'Angenommen'];
const GEKIPPT = ['Für nichtig erklärt', 'Für mit dem Grundgesetz unvereinbar erklärt', 'Teilweise für nichtig erklärt'];
const GESCHEITERT = [
  'Abgelehnt',
  'Einbringung abgelehnt',
  'Bundesrat hat Zustimmung versagt',
  'Zurückgezogen',
  'Für erledigt erklärt',
  'Erledigt durch Ablauf der Wahlperiode',
];

/** Ordnet den DIP-Beratungsstand einer einfachen Ampel zu. Unbekannte Staende gelten als "in Beratung". */
export function ampelFuerStand(beratungsstand: string): GesetzAmpel {
  if (BESCHLOSSEN.includes(beratungsstand)) return 'beschlossen';
  if (GEKIPPT.some((s) => beratungsstand.startsWith(s))) return 'gekippt';
  if (GESCHEITERT.includes(beratungsstand)) return 'gescheitert';
  return 'in-beratung';
}
