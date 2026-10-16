interface D1QueryErgebnis<T> {
  result: Array<{ results: T[] }>;
  success: boolean;
  errors: Array<{ message: string }>;
}

export type D1Abfrage = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

/** Gemeinsamer D1-REST-Zugriff fuer die Bundestag-/Weitblick-Stores (gleiches Muster wie d1Store.ts). */
export function erstelleD1Abfrage(
  accountId: string,
  databaseId: string,
  apiToken: string,
  fetchImpl: typeof fetch = fetch,
): D1Abfrage {
  return async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
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
  };
}
