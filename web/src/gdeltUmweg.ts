// Umweg fuer GDELT-Abfragen der Pipeline: GDELT ist von GitHub-Actions-Servern aus nicht erreichbar
// (Verbindungs-Timeout, getestet 2026-10-16), von Cloudflare aus schon.
// Geschuetzt durch ein Geheimwort (Worker-Secret GDELT_UMWEG_SCHLUESSEL), damit es kein offener Proxy ist.
// Nur GDELT-DOC-Abfragen werden weitergereicht - keine beliebigen URLs.

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';
const ERLAUBTE_PARAMETER = ['query', 'mode', 'maxrecords', 'format', 'timespan', 'sort'];

const globalesFetch: typeof fetch = (input, init) => fetch(input, init);

export async function gdeltUmwegAntwort(
  request: Request,
  schluessel: string | undefined,
  fetchImpl: typeof fetch = globalesFetch,
): Promise<Response> {
  if (!schluessel || request.headers.get('X-Newsspur-Schluessel') !== schluessel) {
    return new Response('Nicht erlaubt', { status: 403 });
  }
  const eingang = new URL(request.url).searchParams;
  const weiter = new URLSearchParams();
  for (const name of ERLAUBTE_PARAMETER) {
    const wert = eingang.get(name);
    if (wert !== null) weiter.set(name, wert);
  }
  if (!weiter.get('query')) return new Response('query fehlt', { status: 400 });

  const antwort = await fetchImpl(`${GDELT_DOC}?${weiter}`);
  return new Response(await antwort.text(), {
    status: antwort.status,
    headers: { 'Content-Type': antwort.headers.get('Content-Type') ?? 'text/plain' },
  });
}
