import type { ThemenStore } from './store.js';
import type { VerarbeitetesThema } from '../types.js';

export class SpeicherThemenStore implements ThemenStore {
  private eintraege = new Map<string, VerarbeitetesThema>();

  async speichern(thema: VerarbeitetesThema): Promise<void> {
    this.eintraege.set(thema.thema.id, thema);
  }

  async alle(): Promise<VerarbeitetesThema[]> {
    return [...this.eintraege.values()];
  }

  async neuereAls(zeitstempel: string): Promise<VerarbeitetesThema[]> {
    return [...this.eintraege.values()].filter((v) => v.thema.aktualisiert >= zeitstempel);
  }
}
