import type { VerarbeitetesThema } from '../types.js';

export interface ThemenStore {
  speichern(thema: VerarbeitetesThema): Promise<void>;
  alle(): Promise<VerarbeitetesThema[]>;
  /** Themen, deren `aktualisiert`-Zeitstempel >= dem uebergebenen ISO-Zeitstempel ist. */
  neuereAls(zeitstempel: string): Promise<VerarbeitetesThema[]>;
}
