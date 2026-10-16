import { themaZuApi } from './aufbereiten.js';
import type { VerarbeitetesThema } from './pipelineTypen.js';
import { bundestagAntwort, weitblickAntwort } from './bundestagWeitblick.js';

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Fehlt, solange R2 im Cloudflare-Konto nicht aktiviert ist (siehe wrangler.jsonc). */
  REELS?: R2Bucket;
  VAPID_PUBLIC_KEY?: string;
}

const REAKTION_EMOJIS = ['😍', '😢', '😂', '😱', '🤬'];

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

async function reelAntwort(env: Env, themaId: string): Promise<Response> {
  if (!env.REELS) return new Response('Nicht gefunden', { status: 404 });
  const objekt = await env.REELS.get(`${themaId}.mp4`);
  if (!objekt) return new Response('Nicht gefunden', { status: 404 });
  return new Response(objekt.body, {
    headers: { 'Content-Type': 'video/mp4', 'Cache-Control': 'public, max-age=3600' },
  });
}

async function reaktionenNachThema(env: Env): Promise<Map<string, Record<string, number>>> {
  const zeilen = await env.DB.prepare('SELECT thema_id, emoji, anzahl FROM reaktionen').all<{
    thema_id: string;
    emoji: string;
    anzahl: number;
  }>();
  const karte = new Map<string, Record<string, number>>();
  for (const zeile of zeilen.results) {
    const eintrag = karte.get(zeile.thema_id) ?? {};
    eintrag[zeile.emoji] = zeile.anzahl;
    karte.set(zeile.thema_id, eintrag);
  }
  return karte;
}

async function themenAntwort(env: Env): Promise<Response> {
  const [veroeffentlichte, zurueckgehalten, reaktionen] = await Promise.all([
    env.DB.prepare(
      "SELECT daten FROM themen WHERE status = 'veroeffentlicht' ORDER BY aktualisiert DESC",
    ).all<{ daten: string }>(),
    env.DB.prepare(
      "SELECT COUNT(*) as anzahl FROM themen WHERE status IN ('wartet', 'zurueckgehalten')",
    ).first<{ anzahl: number }>(),
    reaktionenNachThema(env),
  ]);

  const themen = veroeffentlichte.results
    .map((zeile) => themaZuApi(JSON.parse(zeile.daten) as VerarbeitetesThema))
    .filter((t) => t !== null)
    .map((t) => ({ ...t, reaktionen: reaktionen.get(t.id) ?? {} }));

  return Response.json({ themen, zurueckgehalten: zurueckgehalten?.anzahl ?? 0 });
}

async function reaktionAntwort(env: Env, request: Request): Promise<Response> {
  let body: { themaId?: unknown; emoji?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('Ungueltiger Body', { status: 400 });
  }
  const { themaId, emoji } = body;
  if (typeof themaId !== 'string' || typeof emoji !== 'string' || !REAKTION_EMOJIS.includes(emoji)) {
    return new Response('Ungueltige Reaktion', { status: 400 });
  }

  const thema = await env.DB.prepare('SELECT 1 FROM themen WHERE id = ?').bind(themaId).first();
  if (!thema) return new Response('Thema nicht gefunden', { status: 404 });

  const zeile = await env.DB.prepare(
    `INSERT INTO reaktionen (thema_id, emoji, anzahl) VALUES (?, ?, 1)
     ON CONFLICT(thema_id, emoji) DO UPDATE SET anzahl = anzahl + 1
     RETURNING anzahl`,
  )
    .bind(themaId, emoji)
    .first<{ anzahl: number }>();

  return Response.json({ emoji, anzahl: zeile?.anzahl ?? 1 });
}

function pushPublicKeyAntwort(env: Env): Response {
  if (!env.VAPID_PUBLIC_KEY) return new Response('Push nicht konfiguriert', { status: 503 });
  return Response.json({ publicKey: env.VAPID_PUBLIC_KEY });
}

interface PushAboBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  praeferenzen?: { deutschland?: unknown; tuerkei?: unknown; nahost?: unknown; nurEilmeldungen?: unknown };
}

async function pushAboSpeichern(env: Env, request: Request): Promise<Response> {
  let body: PushAboBody;
  try {
    body = await request.json();
  } catch {
    return new Response('Ungueltiger Body', { status: 400 });
  }
  const { endpoint, keys, praeferenzen } = body;
  if (
    typeof endpoint !== 'string' ||
    typeof keys?.p256dh !== 'string' ||
    typeof keys?.auth !== 'string' ||
    !praeferenzen
  ) {
    return new Response('Ungueltiges Abo', { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO push_abos (endpoint, p256dh, auth, deutschland, tuerkei, nahost, nur_eilmeldungen, erstellt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       p256dh = excluded.p256dh, auth = excluded.auth,
       deutschland = excluded.deutschland, tuerkei = excluded.tuerkei, nahost = excluded.nahost,
       nur_eilmeldungen = excluded.nur_eilmeldungen`,
  )
    .bind(
      endpoint,
      keys.p256dh,
      keys.auth,
      praeferenzen.deutschland ? 1 : 0,
      praeferenzen.tuerkei ? 1 : 0,
      praeferenzen.nahost ? 1 : 0,
      praeferenzen.nurEilmeldungen ? 1 : 0,
      new Date().toISOString(),
    )
    .run();

  return Response.json({ ok: true });
}

async function pushAboLoeschen(env: Env, request: Request): Promise<Response> {
  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('Ungueltiger Body', { status: 400 });
  }
  if (typeof body.endpoint !== 'string') return new Response('Ungueltiges Abo', { status: 400 });

  await env.DB.prepare('DELETE FROM push_abos WHERE endpoint = ?').bind(body.endpoint).run();
  return Response.json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/themen') {
      return themenAntwort(env);
    }
    if (url.pathname === '/api/bundestag') {
      return bundestagAntwort(env.DB);
    }
    if (url.pathname === '/api/weitblick') {
      return weitblickAntwort(env.DB, url.searchParams.get('woche'));
    }
    if (url.pathname === '/api/reaktion' && request.method === 'POST') {
      return reaktionAntwort(env, request);
    }
    if (url.pathname === '/api/push/public-key') {
      return pushPublicKeyAntwort(env);
    }
    if (url.pathname === '/api/push/abo' && request.method === 'POST') {
      return pushAboSpeichern(env, request);
    }
    if (url.pathname === '/api/push/abo' && request.method === 'DELETE') {
      return pushAboLoeschen(env, request);
    }
    const karteMatch = url.pathname.match(/^\/karte\/(.+)\.png$/);
    if (karteMatch) {
      return karteAntwort(env, karteMatch[1]);
    }
    const reelMatch = url.pathname.match(/^\/reel\/(.+)\.mp4$/);
    if (reelMatch) {
      return reelAntwort(env, reelMatch[1]);
    }
    return env.ASSETS.fetch(request);
  },
};
