import { themaZuApi } from './aufbereiten.js';
import type { VerarbeitetesThema } from './pipelineTypen.js';

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
}

async function themenAntwort(env: Env): Promise<Response> {
  const [veroeffentlichte, zurueckgehalten] = await Promise.all([
    env.DB.prepare(
      "SELECT daten FROM themen WHERE status = 'veroeffentlicht' ORDER BY aktualisiert DESC",
    ).all<{ daten: string }>(),
    env.DB.prepare(
      "SELECT COUNT(*) as anzahl FROM themen WHERE status IN ('wartet', 'zurueckgehalten')",
    ).first<{ anzahl: number }>(),
  ]);

  const themen = veroeffentlichte.results
    .map((zeile) => themaZuApi(JSON.parse(zeile.daten) as VerarbeitetesThema))
    .filter((t) => t !== null);

  return Response.json({ themen, zurueckgehalten: zurueckgehalten?.anzahl ?? 0 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/themen') {
      return themenAntwort(env);
    }
    return env.ASSETS.fetch(request);
  },
};
