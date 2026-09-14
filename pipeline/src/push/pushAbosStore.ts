import type { PushAbo } from './types.js';

interface D1QueryErgebnis<T> {
  result: Array<{ results: T[] }>;
  success: boolean;
  errors: Array<{ message: string }>;
}

interface PushAboZeile {
  endpoint: string;
  p256dh: string;
  auth: string;
  deutschland: number;
  tuerkei: number;
  nahost: number;
  nur_eilmeldungen: number;
}

/** D1-REST-Zugriff auf die push_abos-Tabelle (gleiches Muster wie store/d1Store.ts). */
export class D1PushAbosStore {
  constructor(
    private readonly accountId: string,
    private readonly databaseId: string,
    private readonly apiToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async abfragen<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    const antwort = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
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

  async alle(): Promise<PushAbo[]> {
    const zeilen = await this.abfragen<PushAboZeile>(
      'SELECT endpoint, p256dh, auth, deutschland, tuerkei, nahost, nur_eilmeldungen FROM push_abos',
    );
    return zeilen.map((z) => ({
      endpoint: z.endpoint,
      p256dh: z.p256dh,
      auth: z.auth,
      deutschland: !!z.deutschland,
      tuerkei: !!z.tuerkei,
      nahost: !!z.nahost,
      nurEilmeldungen: !!z.nur_eilmeldungen,
    }));
  }

  async entfernen(endpoint: string): Promise<void> {
    await this.abfragen('DELETE FROM push_abos WHERE endpoint = ?', [endpoint]);
  }
}
