/**
 * Kurze, stabile Kennung aus einem String (z.B. einer URL).
 * FNV-1a 32-Bit, als 8-stelliger Hex-String. Rein arithmetisch,
 * keine Node-spezifischen APIs -> laeuft auch in Cloudflare Workers.
 */
export function kurzeHashId(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
