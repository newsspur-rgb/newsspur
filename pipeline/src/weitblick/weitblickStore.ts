import type { D1Abfrage } from '../store/d1Abfrage.js';
import type { WeitblickStore } from './weitblick.js';

export function erstelleD1WeitblickStore(abfragen: D1Abfrage): WeitblickStore {
  return {
    async speichern(weitblick) {
      await abfragen(
        `INSERT INTO weitblick (woche, erstellt, daten) VALUES (?, ?, ?)
         ON CONFLICT(woche) DO UPDATE SET erstellt = excluded.erstellt, daten = excluded.daten`,
        [weitblick.woche, weitblick.erstellt, JSON.stringify(weitblick)],
      );
    },
  };
}
