// Liefert die von der Pipeline (lokal am Mac) gespeicherten X-Stimmen der letzten Tage.
// Die Form ist in pipeline/src/xstimmen/typen.ts definiert.

const MAX_THEMEN = 40;
const ZEITRAUM_TAGE = 3;

export async function xStimmenAntwort(db: D1Database, jetzt: Date = new Date()): Promise<Response> {
  const seit = new Date(jetzt.getTime() - ZEITRAUM_TAGE * 86_400_000).toISOString();
  const zeilen = await db
    .prepare('SELECT daten FROM x_stimmen WHERE aktualisiert >= ? ORDER BY aktualisiert DESC LIMIT ?')
    .bind(seit, MAX_THEMEN)
    .all<{ daten: string }>();
  return Response.json({ themen: zeilen.results.map((z) => JSON.parse(z.daten)) });
}

/** Aktueller Stand je Konflikt (Gegenüberstellung der Seiten), siehe pipeline/src/xstimmen/konflikte.ts. */
export async function konflikteAntwort(db: D1Database): Promise<Response> {
  const zeilen = await db.prepare('SELECT daten FROM x_konflikte ORDER BY aktualisiert DESC').all<{ daten: string }>();
  return Response.json({ konflikte: zeilen.results.map((z) => JSON.parse(z.daten)) });
}
