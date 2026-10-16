import type { GeminiClient } from '../summarize/geminiClient.js';
import type { BundestagStore } from './bundestagStore.js';
import type { DipClient } from './dipClient.js';
import { debatteZusammenfassen } from './debatte.js';

export interface BundestagErgebnis {
  gesetzeAktualisiert: number;
  debatteNeu?: string;
  fehler: number;
}

export interface BundestagAbhaengigkeiten {
  dip: DipClient;
  store: BundestagStore;
  /** Ohne Gemini werden nur die Gesetze aktualisiert (kostet nichts). */
  geminiClient?: GeminiClient;
  rueckblickTage?: number;
}

/**
 * Ein Bundestag-Lauf: Gesetze der letzten Tage aktualisieren und hoechstens EIN neues
 * Plenarprotokoll zusammenfassen (1 Gemini-Aufruf), damit das knappe Kontingent geschont wird.
 */
export async function bundestagLauf(deps: BundestagAbhaengigkeiten): Promise<BundestagErgebnis> {
  const tage = deps.rueckblickTage ?? 3;
  const seit = new Date(Date.now() - tage * 86_400_000).toISOString();
  let fehler = 0;

  const gesetze = await deps.dip.gesetzeSeit(seit);
  for (const gesetz of gesetze) {
    await deps.store.gesetzSpeichern(gesetz);
  }

  let debatteNeu: string | undefined;
  if (deps.geminiClient) {
    const protokolle = await deps.dip.neuesteProtokolle();
    for (const protokoll of protokolle) {
      if (await deps.store.debatteVorhanden(protokoll.id)) continue;
      try {
        const debatte = await debatteZusammenfassen(protokoll, deps.geminiClient);
        await deps.store.debatteSpeichern(debatte);
        debatteNeu = protokoll.titel;
      } catch (fehlerUrsache) {
        console.warn(`Protokoll ${protokoll.id} uebersprungen (naechster Lauf versucht es erneut):`, fehlerUrsache);
        fehler++;
      }
      break; // max. 1 Protokoll pro Lauf
    }
  }

  return { gesetzeAktualisiert: gesetze.length, debatteNeu, fehler };
}
