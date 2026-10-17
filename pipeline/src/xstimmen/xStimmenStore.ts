import type { D1Abfrage } from '../store/d1Abfrage.js';
import type { XStimmenStore } from './xStimmen.js';
import type { XThema } from './typen.js';
import type { KonflikteStore } from './konflikte.js';

export function erstelleD1XStimmenStore(abfragen: D1Abfrage): XStimmenStore {
  return {
    async speichern(thema) {
      await abfragen(
        `INSERT INTO x_stimmen (id, kategorie, thema_id, aktualisiert, daten) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET thema_id = excluded.thema_id, aktualisiert = excluded.aktualisiert, daten = excluded.daten`,
        [thema.id, thema.kategorie, thema.themaId, thema.aktualisiert, JSON.stringify(thema)],
      );
    },
    async seit(iso) {
      const zeilen = await abfragen<{ daten: string }>('SELECT daten FROM x_stimmen WHERE aktualisiert >= ?', [iso]);
      return zeilen.map((z) => JSON.parse(z.daten) as XThema);
    },
  };
}

export function erstelleSpeicherXStimmenStore(): XStimmenStore & { alle: Map<string, XThema> } {
  const alle = new Map<string, XThema>();
  return {
    alle,
    async speichern(thema) { alle.set(thema.id, thema); },
    async seit(iso) { return [...alle.values()].filter((t) => t.aktualisiert >= iso); },
  };
}

export function erstelleD1KonflikteStore(abfragen: D1Abfrage): KonflikteStore {
  return {
    async speichern(lage) {
      await abfragen(
        `INSERT INTO x_konflikte (id, aktualisiert, daten) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET aktualisiert = excluded.aktualisiert, daten = excluded.daten`,
        [lage.id, lage.aktualisiert, JSON.stringify(lage)],
      );
    },
  };
}
