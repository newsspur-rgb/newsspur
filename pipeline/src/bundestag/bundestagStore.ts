import type { D1Abfrage } from '../store/d1Abfrage.js';
import type { Debatte, Gesetz } from './typen.js';

export interface BundestagStore {
  gesetzSpeichern(gesetz: Gesetz): Promise<void>;
  gesetzeSeit(zeitstempel: string): Promise<Gesetz[]>;
  debatteVorhanden(id: string): Promise<boolean>;
  debatteSpeichern(debatte: Debatte): Promise<void>;
}

export function erstelleD1BundestagStore(abfragen: D1Abfrage): BundestagStore {
  return {
    async gesetzSpeichern(gesetz) {
      await abfragen(
        `INSERT INTO bundestag_gesetze (id, aktualisiert, daten) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET aktualisiert = excluded.aktualisiert, daten = excluded.daten`,
        [gesetz.id, gesetz.aktualisiert, JSON.stringify(gesetz)],
      );
    },
    async gesetzeSeit(zeitstempel) {
      const zeilen = await abfragen<{ daten: string }>(
        'SELECT daten FROM bundestag_gesetze WHERE aktualisiert >= ? ORDER BY aktualisiert DESC',
        [zeitstempel],
      );
      return zeilen.map((z) => JSON.parse(z.daten) as Gesetz);
    },
    async debatteVorhanden(id) {
      const zeilen = await abfragen('SELECT 1 FROM bundestag_debatten WHERE id = ?', [id]);
      return zeilen.length > 0;
    },
    async debatteSpeichern(debatte) {
      await abfragen(
        `INSERT INTO bundestag_debatten (id, datum, daten) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET datum = excluded.datum, daten = excluded.daten`,
        [debatte.id, debatte.datum, JSON.stringify(debatte)],
      );
    },
  };
}

/** Fluechtiger Speicher fuer lokale Testlaeufe ohne Cloudflare-Zugang. */
export function erstelleSpeicherBundestagStore(): BundestagStore & { gesetze: Map<string, Gesetz>; debatten: Map<string, Debatte> } {
  const gesetze = new Map<string, Gesetz>();
  const debatten = new Map<string, Debatte>();
  return {
    gesetze,
    debatten,
    async gesetzSpeichern(g) { gesetze.set(g.id, g); },
    async gesetzeSeit(z) {
      return [...gesetze.values()].filter((g) => g.aktualisiert >= z).sort((a, b) => b.aktualisiert.localeCompare(a.aktualisiert));
    },
    async debatteVorhanden(id) { return debatten.has(id); },
    async debatteSpeichern(d) { debatten.set(d.id, d); },
  };
}
