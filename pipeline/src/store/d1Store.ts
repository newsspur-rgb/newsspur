import type { ThemenStore } from './store.js';
import type { VerarbeitetesThema } from '../types.js';

interface D1QueryErgebnis<T> {
  result: Array<{ results: T[] }>;
  success: boolean;
  errors: Array<{ message: string }>;
}

export class D1ThemenStore implements ThemenStore {
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

  async speichern(thema: VerarbeitetesThema): Promise<void> {
    await this.abfragen(
      `INSERT INTO themen (id, status, aktualisiert, daten) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, aktualisiert = excluded.aktualisiert, daten = excluded.daten`,
      [thema.thema.id, thema.status, thema.thema.aktualisiert, JSON.stringify(thema)],
    );
  }

  async alle(): Promise<VerarbeitetesThema[]> {
    const zeilen = await this.abfragen<{ daten: string }>('SELECT daten FROM themen');
    return zeilen.map((z) => JSON.parse(z.daten) as VerarbeitetesThema);
  }

  async neuereAls(zeitstempel: string): Promise<VerarbeitetesThema[]> {
    const zeilen = await this.abfragen<{ daten: string }>(
      'SELECT daten FROM themen WHERE aktualisiert >= ?',
      [zeitstempel],
    );
    return zeilen.map((z) => JSON.parse(z.daten) as VerarbeitetesThema);
  }
}
