/**
 * GDELT ist von GitHub-Actions-Servern aus nicht erreichbar (Verbindungs-Timeout, 2026-10-16).
 * Ist GDELT_UMWEG_SCHLUESSEL gesetzt, laufen die Abfragen ueber den Cloudflare-Worker (newsspur.de/api/intern/gdelt),
 * sonst direkt (z. B. lokal).
 */
const GDELT_DIREKT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const GDELT_UMWEG = 'https://newsspur.de/api/intern/gdelt';

export function gdeltZiel(env: NodeJS.ProcessEnv = process.env): { basisUrl: string; headers: Record<string, string> } {
  const schluessel = env.GDELT_UMWEG_SCHLUESSEL;
  if (schluessel) return { basisUrl: GDELT_UMWEG, headers: { 'X-Newsspur-Schluessel': schluessel } };
  return { basisUrl: GDELT_DIREKT, headers: {} };
}
