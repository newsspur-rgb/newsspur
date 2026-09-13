interface D1QueryErgebnis {
  result: Array<{ results: unknown[] }>;
  success: boolean;
  errors: Array<{ message: string }>;
}

export interface KartenSpeicher {
  speichern(themaId: string, png: Buffer): Promise<void>;
}

export function erstelleD1KartenSpeicher(
  accountId: string,
  databaseId: string,
  apiToken: string,
  fetchImpl: typeof fetch = fetch,
): KartenSpeicher {
  return {
    async speichern(themaId, png) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
      const antwort = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: `INSERT INTO karten (thema_id, png_base64, erstellt) VALUES (?, ?, ?)
                ON CONFLICT(thema_id) DO UPDATE SET png_base64 = excluded.png_base64, erstellt = excluded.erstellt`,
          params: [themaId, png.toString('base64'), new Date().toISOString()],
        }),
      });
      if (!antwort.ok) {
        throw new Error(`Karten-Speicherung antwortete mit Status ${antwort.status}`);
      }
      const daten = (await antwort.json()) as D1QueryErgebnis;
      if (!daten.success) {
        throw new Error(`Karten-Speicherung fehlgeschlagen: ${daten.errors.map((e) => e.message).join('; ')}`);
      }
    },
  };
}
