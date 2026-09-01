import type { Thema, ThemenZusammenfassung } from '../types.js';
import type { GeminiClient } from './geminiClient.js';
import { promptErstellen, ZUSAMMENFASSUNGS_SCHEMA } from './prompt.js';

function istGueltig(wert: unknown): wert is Omit<ThemenZusammenfassung, 'themaId'> {
  if (typeof wert !== 'object' || wert === null) return false;
  const w = wert as Record<string, unknown>;
  const kw = w.kategorieWerte as Record<string, unknown> | undefined;
  return (
    typeof w.schlagzeile === 'string' &&
    typeof w.zusammenfassung === 'string' &&
    typeof kw === 'object' && kw !== null &&
    typeof kw.deutschland === 'number' && typeof kw.tuerkei === 'number' && typeof kw.nahost === 'number' &&
    typeof w.wichtigkeit === 'number' &&
    typeof w.wichtigkeitBegruendung === 'string' &&
    Array.isArray(w.fakten) &&
    w.fakten.every((f: any) => typeof f?.text === 'string' && Array.isArray(f?.belegtDurch)) &&
    Array.isArray(w.strittigePunkte) &&
    (w.sicherheit === 'hoch' || w.sicherheit === 'mittel' || w.sicherheit === 'niedrig')
  );
}

export async function themaZusammenfassen(thema: Thema, client: GeminiClient): Promise<ThemenZusammenfassung> {
  const roh = await client.strukturierteAntwort(promptErstellen(thema.artikel), ZUSAMMENFASSUNGS_SCHEMA);
  if (!istGueltig(roh)) {
    throw new Error('Gemini-Antwort hat nicht die erwartete Form (ungueltige Zusammenfassung)');
  }
  return { ...roh, themaId: thema.id };
}
