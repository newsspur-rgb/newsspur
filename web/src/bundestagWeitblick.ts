// Liefert die von der Pipeline gespeicherten Bundestag- und Weitblick-Daten unveraendert als JSON aus.
// Die Form ist in pipeline/src/bundestag/typen.ts und pipeline/src/weitblick/typen.ts definiert.

const MAX_GESETZE = 40;
const MAX_DEBATTEN = 5;
const MAX_WOCHEN = 12;

export async function bundestagAntwort(db: D1Database): Promise<Response> {
  const [gesetze, debatten] = await Promise.all([
    db.prepare('SELECT daten FROM bundestag_gesetze ORDER BY aktualisiert DESC LIMIT ?').bind(MAX_GESETZE).all<{ daten: string }>(),
    db.prepare('SELECT daten FROM bundestag_debatten ORDER BY datum DESC LIMIT ?').bind(MAX_DEBATTEN).all<{ daten: string }>(),
  ]);
  return Response.json({
    gesetze: gesetze.results.map((z) => JSON.parse(z.daten)),
    debatten: debatten.results.map((z) => JSON.parse(z.daten)),
  });
}

export async function weitblickAntwort(db: D1Database, woche: string | null): Promise<Response> {
  const [wochen, eintrag] = await Promise.all([
    db.prepare('SELECT woche FROM weitblick ORDER BY woche DESC LIMIT ?').bind(MAX_WOCHEN).all<{ woche: string }>(),
    woche
      ? db.prepare('SELECT daten FROM weitblick WHERE woche = ?').bind(woche).first<{ daten: string }>()
      : db.prepare('SELECT daten FROM weitblick ORDER BY woche DESC LIMIT 1').first<{ daten: string }>(),
  ]);
  return Response.json({
    weitblick: eintrag ? JSON.parse(eintrag.daten) : null,
    wochen: wochen.results.map((z) => z.woche),
  });
}
