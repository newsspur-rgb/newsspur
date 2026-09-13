import { themaZuApi } from './aufbereiten.js';
import type { VerarbeitetesThema } from './pipelineTypen.js';

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
}

function base64ZuBytes(base64: string): Uint8Array {
  const binaer = atob(base64);
  const bytes = new Uint8Array(binaer.length);
  for (let i = 0; i < binaer.length; i++) bytes[i] = binaer.charCodeAt(i);
  return bytes;
}

async function karteAntwort(env: Env, themaId: string): Promise<Response> {
  const zeile = await env.DB.prepare('SELECT png_base64 FROM karten WHERE thema_id = ?')
    .bind(themaId)
    .first<{ png_base64: string }>();
  if (!zeile) return new Response('Nicht gefunden', { status: 404 });
  return new Response(base64ZuBytes(zeile.png_base64).buffer as ArrayBuffer, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
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
    const karteMatch = url.pathname.match(/^\/karte\/(.+)\.png$/);
    if (karteMatch) {
      return karteAntwort(env, karteMatch[1]);
    }
    return env.ASSETS.fetch(request);
  },
};
