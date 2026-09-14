interface D1QueryErgebnis<T> {
  result: Array<{ results: T[] }>;
  success: boolean;
  errors: Array<{ message: string }>;
}

export interface ReelTagStore {
  /** Prueft, ob fuer das gegebene Datum (YYYY-MM-DD) bereits ein Reel gesendet wurde. */
  gesendetHeute(datum: string): Promise<boolean>;
  /** Markiert das Datum als "Reel gesendet" - ignoriert stillschweigend, falls schon markiert. */
  markieren(datum: string, themaId: string): Promise<void>;
}

/** D1-REST-Zugriff auf die reel_gesendet_heute-Tabelle (gleiches Muster wie store/d1Store.ts). */
export function erstelleD1ReelTagStore(
  accountId: string,
  databaseId: string,
  apiToken: string,
  fetchImpl: typeof fetch = fetch,
): ReelTagStore {
  async function abfragen<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const antwort = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    if (!antwort.ok) {
      throw new Error(`D1-Abfrage antwortete mit Status ${antwort.status}`);
    }
    const daten = (await antwort.json()) as D1QueryErgebnis<T>;
    if (!daten.success) {
      throw new Error(`D1-Abfrage fehlgeschlagen: ${daten.errors.map((e) => e.message).join('; ')}`);
    }
    return daten.result[0]?.results ?? [];
  }

  return {
    async gesendetHeute(datum) {
      const zeilen = await abfragen<{ datum: string }>('SELECT datum FROM reel_gesendet_heute WHERE datum = ?', [datum]);
      return zeilen.length > 0;
    },
    async markieren(datum, themaId) {
      await abfragen('INSERT INTO reel_gesendet_heute (datum, thema_id) VALUES (?, ?) ON CONFLICT(datum) DO NOTHING', [
        datum,
        themaId,
      ]);
    },
  };
}
