import type { GeminiClient } from '../summarize/geminiClient.js';
import type { Thema, ThemenZusammenfassung } from '../types.js';
import { nahostSonderregelPruefen } from '../rules/nahostRegel.js';

export const HOOK_SCHEMA = {
  type: 'object',
  properties: { hook: { type: 'string' } },
  required: ['hook'],
};

function hookPromptErstellen(zusammenfassung: ThemenZusammenfassung): string {
  return `Du schreibst die erste Zeile eines Instagram-Posts fuer NEWSSPUR zu dieser Meldung:
"${zusammenfassung.schlagzeile}"
${zusammenfassung.zusammenfassung}

Aufgabe: Eine einzige Zeile (max. 15 Woerter), die zum Weiterlesen zieht - zugespitzt, direkt,
gern mit Zahl oder Frage, aber NUR mit Fakten aus der Meldung oben. Nichts erfinden oder
uebertreiben, was dort nicht steht. Keine Hashtags, keine Emojis, kein Punkt am Satzende.
Auf Deutsch.`;
}

interface HookRoh {
  hook: string;
}

function istHookAntwort(wert: unknown): wert is HookRoh {
  return typeof wert === 'object' && wert !== null && typeof (wert as HookRoh).hook === 'string';
}

/**
 * Zugespitzte erste Zeile fuer Social-Media-Captions - bei Nahost-Themen mit Zurueckhaltung
 * (siehe nahostRegel.ts) bleibt es bei der neutralen Schlagzeile, um die journalistische Linie
 * nicht fuer Reichweite zu opfern. Scheitert der Gemini-Aufruf, faellt es ebenfalls darauf zurueck.
 */
export async function hookErstellen(
  zusammenfassung: ThemenZusammenfassung,
  thema: Thema,
  geminiClient: GeminiClient,
): Promise<string> {
  // Betroffen = schon jede Nahost-Meldung, nicht erst die "zurueckhalten"-Faelle - bei diesem
  // Thema wird bewusst nicht fuer Reichweite zugespitzt.
  if (nahostSonderregelPruefen(zusammenfassung, thema).betroffen) return zusammenfassung.schlagzeile;

  try {
    const antwort = await geminiClient.strukturierteAntwort(hookPromptErstellen(zusammenfassung), HOOK_SCHEMA);
    if (!istHookAntwort(antwort) || antwort.hook.trim().length === 0) return zusammenfassung.schlagzeile;
    return antwort.hook.trim();
  } catch (fehlerUrsache) {
    console.warn('Hook-Erstellung fehlgeschlagen, nutze Schlagzeile:', fehlerUrsache);
    return zusammenfassung.schlagzeile;
  }
}
