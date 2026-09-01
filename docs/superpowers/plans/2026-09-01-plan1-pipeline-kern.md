# Plan 1 – Nachrichten-Pipeline (Kern) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine lokal lauffähige, getestete Nachrichten-Pipeline, die RSS-Feeds und GDELT abruft, Artikel zu Themen bündelt, schwach belegte Themen herausfiltert und aus jedem Thema mit Google Gemini eine geprüfte, mehrfach kategorisierte deutsche Zusammenfassung erzeugt.

**Architecture:** TypeScript/Node.js-Modul (`pipeline/`), reine Funktionen mit injizierten Abhängigkeiten (Fetch, Gemini-Client, Embedding-Funktion, Speicher). Jeder Pipeline-Schritt ist ein eigenes, isoliert testbares Modul; `pipeline.ts` verdrahtet sie. Kein HTTP-Server, keine Datenbank, keine Cloud – das kommt in Plan 2. Speicherung läuft über eine `ThemenStore`-Schnittstelle mit einer In-Memory-Implementierung; Plan 2 ersetzt sie durch Cloudflare D1.

**Tech Stack:** Node.js ≥ 20 LTS, TypeScript (ESM), Vitest (Tests), `fast-xml-parser` (RSS), `dotenv` + `tsx` (lokaler Runner). Gemini-Aufrufe über `fetch` gegen die REST-API (kein SDK → später Cloudflare-Workers-kompatibel).

**Spec:** `docs/superpowers/specs/2026-09-01-news-pwa-design.md`

## Global Constraints

- **Kosten:** 0 € laufend, nur Gratis-Kontingente. Keine kostenpflichtigen Abhängigkeiten oder Dienste.
- **Kein Volltext:** Es wird **nie** ein Artikel-Volltext gespeichert oder weitergegeben – nur Schlagzeile, kurzer Anriss (`teaser`, max. 500 Zeichen), URL, Bild-URL, Datum, Quelle.
- **Zwei-Quellen-Regel:** Ein Thema wird erst nach der KI-Zusammenfassung weiterverarbeitet, wenn **≥ 2 Artikel von verschiedenen Verlagen** (`quelle.id`) vorliegen. Berufen sich alle auf dieselbe Agentur → „schwache" Bestätigung.
- **KI erfindet nichts:** Gemini bekommt nur die Teaser und darf nur daraus zusammenfassen. Jeder Fakt trägt im Feld `belegtDurch` die Kennung(en) der stützenden Quelle(n).
- **Fakten-Gegenprüfung:** Hat ein Fakt keine (gültige) Beleg-Quelle → Sicherheit wird auf `niedrig` gesetzt und das Thema zurückgehalten (nicht gelöscht).
- **Kategorie-Schwelle:** Ein Thema gehört zu einer Kategorie (Deutschland / Türkei / Nahost), wenn sein Wert dort **≥ 40** ist. Werte werden für alle drei Kategorien unabhängig vergeben (0–100).
- **Nahost-Sonderregel:** Nahost-relevante Themen mit Opferzahlen/Schuldzuweisungen werden zurückgehalten, wenn nicht beide Seiten unter den Quellen vertreten sind oder die Sicherheit `niedrig` ist.
- **Zeitfenster:** Ein Thema gilt 48 Stunden als „aktiv" (für die Bündelung neuer Artikel an bestehende Themen).
- **Sprache:** Zusammenfassungen auf Deutsch, auch bei fremdsprachigen Quellen. Die Originalsprache der Quelle wird gespeichert (`quelle.sprache`).
- **Portabilität:** Kein Node-only-API (`fs`, `crypto`-Modul, `path`) im `src/`-Kern außer im CLI-Runner. IDs über eine eigene Hash-Funktion, nicht über `node:crypto`.

## Umfang

**In Plan 1 enthalten:** Sammeln (RSS + GDELT), Bündeln, Zwei-Quellen-Filter, Gemini-Zusammenfassung, Fakten-Gegenprüfung, Kategorie-Regeln, Nahost-Sonderregel, Orchestrierung, lokaler CLI-Runner.

**NICHT in Plan 1 (→ Plan 2):** Cloudflare D1, GitHub-Actions-Takt, Fehler-Benachrichtigung, Betreiber-Dashboard, Push-Versand, Persistenz zwischen Läufen.

**NICHT in Plan 1 (→ Plan 3):** PWA-Frontend, Feed-/Detail-Ansicht, Bilder-Anzeige mit Fallback-Kachel, Medienschau-Block, Onboarding, Einstellungen, Impressum/Datenschutz.

---

### Task 1: Projektgerüst, Domänen-Typen, Hash-Hilfsfunktion

**Files:**
- Create: `pipeline/package.json`
- Create: `pipeline/tsconfig.json`
- Create: `pipeline/vitest.config.ts`
- Create: `pipeline/.gitignore`
- Create: `pipeline/.env.example`
- Create: `pipeline/src/types.ts`
- Create: `pipeline/src/util/hash.ts`
- Test: `pipeline/test/util/hash.test.ts`

**Interfaces:**
- Consumes: nichts (erste Task).
- Produces:
  - `pipeline/src/types.ts` exportiert:
    ```ts
    export type Sprache = 'de' | 'tr' | 'ar' | 'en';
    export type VerlagTyp = 'oeffentlich-rechtlich' | 'zeitung' | 'agentur' | 'staatsnah' | 'unabhaengig';
    export type Land = 'DE' | 'TR' | 'INT';
    export interface Quelle { id: string; name: string; typ: VerlagTyp; land: Land; sprache: Sprache; }
    export interface Feed { quelle: Quelle; url: string; }
    export interface Artikel { id: string; quelle: Quelle; titel: string; teaser: string; url: string; bildUrl?: string; veroeffentlichtAm: string; }
    export interface Thema { id: string; artikel: Artikel[]; erstellt: string; aktualisiert: string; }
    export type Sicherheit = 'hoch' | 'mittel' | 'niedrig';
    export interface KategorieWerte { deutschland: number; tuerkei: number; nahost: number; }
    export interface Fakt { text: string; belegtDurch: string[]; }
    export interface ThemenZusammenfassung { themaId: string; schlagzeile: string; zusammenfassung: string; kategorieWerte: KategorieWerte; wichtigkeit: number; wichtigkeitBegruendung: string; fakten: Fakt[]; strittigePunkte: string[]; sicherheit: Sicherheit; }
    export type Verarbeitungsstatus = 'wartet' | 'zurueckgehalten' | 'veroeffentlicht';
    export interface VerarbeitetesThema { thema: Thema; zusammenfassung?: ThemenZusammenfassung; status: Verarbeitungsstatus; grund?: string; }
    ```
  - `pipeline/src/util/hash.ts` exportiert: `export function kurzeHashId(input: string): string` – 8-stelliger Hex-String, FNV-1a.

- [ ] **Step 1: `pipeline/package.json` anlegen**

```json
{
  "name": "newsapp-pipeline",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  },
  "dependencies": {
    "fast-xml-parser": "^4.5.1"
  }
}
```

- [ ] **Step 2: `pipeline/tsconfig.json` anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "rootDir": "."
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: `pipeline/vitest.config.ts` anlegen**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: `pipeline/.gitignore` und `pipeline/.env.example` anlegen**

`.gitignore`:
```
node_modules
.env
dist
```

`.env.example`:
```
# Kostenloser Google-Gemini-API-Schluessel: https://aistudio.google.com/apikey
GEMINI_API_KEY=
```

- [ ] **Step 5: Abhängigkeiten installieren**

Run: `cd pipeline && npm install`
Expected: `node_modules/` entsteht, keine Fehler.

- [ ] **Step 6: `pipeline/src/types.ts` anlegen**

Inhalt: exakt der Typenblock aus **Interfaces → Produces** oben.

- [ ] **Step 7: Fehlschlagenden Test für `kurzeHashId` schreiben**

Create `pipeline/test/util/hash.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { kurzeHashId } from '../../src/util/hash.js';

describe('kurzeHashId', () => {
  it('liefert fuer denselben Input immer denselben Hash', () => {
    expect(kurzeHashId('https://example.com/artikel-1')).toBe(kurzeHashId('https://example.com/artikel-1'));
  });

  it('liefert fuer unterschiedlichen Input unterschiedliche Hashes', () => {
    expect(kurzeHashId('https://example.com/artikel-1')).not.toBe(kurzeHashId('https://example.com/artikel-2'));
  });

  it('liefert einen 8-stelligen Hex-String', () => {
    expect(kurzeHashId('test')).toMatch(/^[0-9a-f]{8}$/);
  });
});
```

- [ ] **Step 8: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/util/hash.test.ts`
Expected: FAIL – `Cannot find module '../../src/util/hash.js'`.

- [ ] **Step 9: `pipeline/src/util/hash.ts` implementieren**

```ts
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
```

- [ ] **Step 10: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/util/hash.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 11: Typecheck**

Run: `cd pipeline && npm run typecheck`
Expected: keine Fehler.

- [ ] **Step 12: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): Projektgeruest, Domaenen-Typen, Hash-Hilfsfunktion"
```

---

### Task 2: RSS-Feed-Fetcher

**Files:**
- Create: `pipeline/src/sources/feeds.ts`
- Create: `pipeline/src/sources/fetchRss.ts`
- Test: `pipeline/test/sources/fetchRss.test.ts`

**Interfaces:**
- Consumes: `Artikel`, `Feed`, `Quelle` aus `../types.js`; `kurzeHashId` aus `../util/hash.js`.
- Produces:
  - `feeds.ts`: `export const feeds: Feed[]`
  - `fetchRss.ts`: `export async function feedAbrufen(feed: Feed, fetchImpl?: typeof fetch): Promise<Artikel[]>`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Create `pipeline/test/sources/fetchRss.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { feedAbrufen } from '../../src/sources/fetchRss.js';
import type { Feed } from '../../src/types.js';

const testQuelle = { id: 'test-quelle', name: 'Test Quelle', typ: 'zeitung' as const, land: 'DE' as const, sprache: 'de' as const };

const beispielRss2 = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Erdogan besucht Berlin</title>
      <link>https://example.com/erdogan-berlin</link>
      <description>Der tuerkische Praesident traf den Kanzler.</description>
      <pubDate>Mon, 01 Sep 2026 09:15:00 GMT</pubDate>
      <enclosure url="https://example.com/bild.jpg" type="image/jpeg" />
    </item>
    <item>
      <title>Grundsteuer in NRW steigt</title>
      <link>https://example.com/grundsteuer</link>
      <description>Die Landesregierung beschliesst neue Saetze.</description>
      <pubDate>Mon, 01 Sep 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

function fakeFetch(xml: string, status = 200): typeof fetch {
  return vi.fn(async () => ({ ok: status < 400, status, text: async () => xml })) as unknown as typeof fetch;
}

describe('feedAbrufen', () => {
  it('parst RSS-2.0-Items zu Artikeln', async () => {
    const feed: Feed = { quelle: testQuelle, url: 'https://example.com/rss' };
    const artikel = await feedAbrufen(feed, fakeFetch(beispielRss2));
    expect(artikel).toHaveLength(2);
    expect(artikel[0].titel).toBe('Erdogan besucht Berlin');
    expect(artikel[0].url).toBe('https://example.com/erdogan-berlin');
    expect(artikel[0].teaser).toContain('Praesident');
    expect(artikel[0].bildUrl).toBe('https://example.com/bild.jpg');
    expect(artikel[0].quelle).toEqual(testQuelle);
    expect(artikel[0].id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('erzeugt fuer dieselbe URL immer dieselbe Artikel-ID', async () => {
    const feed: Feed = { quelle: testQuelle, url: 'https://example.com/rss' };
    const [erst] = await feedAbrufen(feed, fakeFetch(beispielRss2));
    const [zweit] = await feedAbrufen(feed, fakeFetch(beispielRss2));
    expect(erst.id).toBe(zweit.id);
  });

  it('wirft einen Fehler bei fehlerhafter HTTP-Antwort', async () => {
    const feed: Feed = { quelle: testQuelle, url: 'https://example.com/rss' };
    await expect(feedAbrufen(feed, fakeFetch('', 503))).rejects.toThrow('503');
  });

  it('ueberspringt Items ohne Titel oder Link', async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><item><description>Kein Titel</description></item></channel></rss>`;
    const feed: Feed = { quelle: testQuelle, url: 'https://example.com/rss' };
    expect(await feedAbrufen(feed, fakeFetch(xml))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/sources/fetchRss.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 3: `pipeline/src/sources/fetchRss.ts` implementieren**

```ts
import { XMLParser } from 'fast-xml-parser';
import type { Artikel, Feed } from '../types.js';
import { kurzeHashId } from '../util/hash.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function alsArray<T>(wert: T | T[] | undefined): T[] {
  if (wert === undefined || wert === null) return [];
  return Array.isArray(wert) ? wert : [wert];
}

function bildAusItem(item: any): string | undefined {
  return item?.enclosure?.['@_url'] ?? item?.['media:content']?.['@_url'] ?? item?.['media:thumbnail']?.['@_url'] ?? undefined;
}

function datumAusItem(item: any): string {
  const roh = item?.pubDate ?? item?.['dc:date'] ?? item?.published ?? item?.updated;
  const datum = roh ? new Date(roh) : new Date();
  return isNaN(datum.getTime()) ? new Date().toISOString() : datum.toISOString();
}

function textFeld(wert: any): string | undefined {
  if (typeof wert === 'string') return wert;
  if (wert && typeof wert['#text'] === 'string') return wert['#text'];
  return undefined;
}

function linkAusItem(item: any): string | undefined {
  if (typeof item?.link === 'string') return item.link;
  if (item?.link?.['@_href']) return item.link['@_href'];
  if (Array.isArray(item?.link)) {
    const alternate = item.link.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel']);
    return alternate?.['@_href'];
  }
  return textFeld(item?.link) ?? textFeld(item?.guid);
}

export async function feedAbrufen(feed: Feed, fetchImpl: typeof fetch = fetch): Promise<Artikel[]> {
  const antwort = await fetchImpl(feed.url);
  if (!antwort.ok) {
    throw new Error(`Feed ${feed.quelle.id} antwortete mit Status ${antwort.status}`);
  }
  const daten = parser.parse(await antwort.text());
  const rohItems = alsArray(
    daten?.rss?.channel?.item ?? daten?.['rdf:RDF']?.item ?? daten?.feed?.entry,
  );

  const artikel: Artikel[] = [];
  for (const item of rohItems) {
    const titel = textFeld(item?.title)?.trim();
    const url = linkAusItem(item)?.trim();
    if (!titel || !url) continue;
    const teaser = String(item?.description ?? item?.summary ?? item?.['content:encoded'] ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    artikel.push({
      id: kurzeHashId(url),
      quelle: feed.quelle,
      titel,
      teaser,
      url,
      bildUrl: bildAusItem(item),
      veroeffentlichtAm: datumAusItem(item),
    });
  }
  return artikel;
}
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/sources/fetchRss.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 5: `pipeline/src/sources/feeds.ts` implementieren**

```ts
import type { Feed } from '../types.js';

// Neue Quelle = eine Zeile. URLs werden bei der Ausfuehrung (Task 11) gegen
// die echten Feeds geprueft und ggf. korrigiert.
export const feeds: Feed[] = [
  { quelle: { id: 'tagesschau', name: 'Tagesschau', typ: 'oeffentlich-rechtlich', land: 'DE', sprache: 'de' }, url: 'https://www.tagesschau.de/index~rss2.xml' },
  { quelle: { id: 'zeit', name: 'Zeit Online', typ: 'zeitung', land: 'DE', sprache: 'de' }, url: 'https://newsfeed.zeit.de/index' },
  { quelle: { id: 'spiegel', name: 'Der Spiegel', typ: 'zeitung', land: 'DE', sprache: 'de' }, url: 'https://www.spiegel.de/schlagzeilen/tops/index.rss' },

  { quelle: { id: 'dw-tuerkisch', name: 'DW Tuerkce', typ: 'unabhaengig', land: 'TR', sprache: 'tr' }, url: 'https://rss.dw.com/rdf/rss-tur-all' },
  { quelle: { id: 'trt-haber', name: 'TRT Haber', typ: 'staatsnah', land: 'TR', sprache: 'tr' }, url: 'https://www.trthaber.com/xml_mobile.php?tur=xml_genel' },
  { quelle: { id: 'bianet', name: 'Bianet', typ: 'unabhaengig', land: 'TR', sprache: 'tr' }, url: 'https://bianet.org/rss.php' },

  { quelle: { id: 'bbc-nahost', name: 'BBC Middle East', typ: 'oeffentlich-rechtlich', land: 'INT', sprache: 'en' }, url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
  { quelle: { id: 'al-jazeera', name: 'Al Jazeera', typ: 'staatsnah', land: 'INT', sprache: 'en' }, url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { quelle: { id: 'times-of-israel', name: 'Times of Israel', typ: 'zeitung', land: 'INT', sprache: 'en' }, url: 'https://www.timesofisrael.com/feed/' },
];
```

- [ ] **Step 6: Typecheck + alle Tests**

Run: `cd pipeline && npm run typecheck && npm test`
Expected: alle Tests grün.

- [ ] **Step 7: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): RSS-Feed-Fetcher und Quellenliste"
```

---

### Task 3: GDELT-Fetcher

**Files:**
- Create: `pipeline/src/sources/gdeltAbfragen.ts`
- Create: `pipeline/src/sources/fetchGdelt.ts`
- Test: `pipeline/test/sources/fetchGdelt.test.ts`

**Interfaces:**
- Consumes: `Artikel`, `Quelle` aus `../types.js`; `kurzeHashId` aus `../util/hash.js`.
- Produces:
  - `gdeltAbfragen.ts`: `export interface GdeltAbfrage { kategorie: 'deutschland' | 'tuerkei' | 'nahost'; suchbegriff: string; }` und `export const gdeltAbfragen: GdeltAbfrage[]`
  - `fetchGdelt.ts`: `export async function gdeltAbrufen(abfrage: GdeltAbfrage, timespanMinuten?: number, fetchImpl?: typeof fetch): Promise<Artikel[]>`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Create `pipeline/test/sources/fetchGdelt.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { gdeltAbrufen } from '../../src/sources/fetchGdelt.js';
import type { GdeltAbfrage } from '../../src/sources/gdeltAbfragen.js';

const abfrage: GdeltAbfrage = { kategorie: 'nahost', suchbegriff: 'Gaza OR Israel' };

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;
}

describe('gdeltAbrufen', () => {
  it('mappt GDELT-Artikel auf das Artikel-Format', async () => {
    const antwort = {
      articles: [
        { url: 'https://news.example/1', title: 'Bericht aus Gaza', seendate: '20260901T091500Z', socialimage: 'https://news.example/1.jpg', domain: 'news.example', language: 'English', sourcecountry: 'United States' },
      ],
    };
    const artikel = await gdeltAbrufen(abfrage, 30, fakeFetch(antwort));
    expect(artikel).toHaveLength(1);
    expect(artikel[0].titel).toBe('Bericht aus Gaza');
    expect(artikel[0].url).toBe('https://news.example/1');
    expect(artikel[0].teaser).toBe('Bericht aus Gaza');
    expect(artikel[0].bildUrl).toBe('https://news.example/1.jpg');
    expect(artikel[0].veroeffentlichtAm).toBe('2026-09-01T09:15:00Z');
    expect(artikel[0].quelle.id).toBe('gdelt-news.example');
    expect(artikel[0].id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('liefert eine leere Liste, wenn keine Artikel enthalten sind', async () => {
    expect(await gdeltAbrufen(abfrage, 30, fakeFetch({}))).toEqual([]);
  });

  it('ueberspringt Eintraege ohne URL oder Titel', async () => {
    const antwort = { articles: [{ title: 'Ohne URL', seendate: '20260901T091500Z', domain: 'x.example' }] };
    expect(await gdeltAbrufen(abfrage, 30, fakeFetch(antwort))).toHaveLength(0);
  });

  it('wirft einen Fehler bei fehlerhafter HTTP-Antwort', async () => {
    await expect(gdeltAbrufen(abfrage, 30, fakeFetch(null, 429))).rejects.toThrow('429');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/sources/fetchGdelt.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 3: `pipeline/src/sources/gdeltAbfragen.ts` implementieren**

```ts
export interface GdeltAbfrage {
  kategorie: 'deutschland' | 'tuerkei' | 'nahost';
  suchbegriff: string;
}

export const gdeltAbfragen: GdeltAbfrage[] = [
  { kategorie: 'deutschland', suchbegriff: '(Deutschland OR Bundestag OR Bundesregierung) sourcelang:ger' },
  { kategorie: 'tuerkei', suchbegriff: '(Turkey OR Tuerkiye OR Erdogan) sourcelang:tur' },
  { kategorie: 'nahost', suchbegriff: '(Gaza OR Israel OR "West Bank" OR Hezbollah OR Iran) sourcelang:eng' },
];
```

- [ ] **Step 4: `pipeline/src/sources/fetchGdelt.ts` implementieren**

```ts
import type { Artikel, Quelle } from '../types.js';
import { kurzeHashId } from '../util/hash.js';
import type { GdeltAbfrage } from './gdeltAbfragen.js';

const GDELT_BASIS_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

interface GdeltArtikelRoh {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
}

function gdeltDatumZuIso(seendate: string | undefined): string {
  const treffer = seendate?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!treffer) return new Date().toISOString();
  const [, j, m, t, h, min, s] = treffer;
  return `${j}-${m}-${t}T${h}:${min}:${s}Z`;
}

function quelleAusDomain(domain: string): Quelle {
  return { id: `gdelt-${domain}`, name: domain, typ: 'unabhaengig', land: 'INT', sprache: 'en' };
}

export async function gdeltAbrufen(
  abfrage: GdeltAbfrage,
  timespanMinuten = 30,
  fetchImpl: typeof fetch = fetch,
): Promise<Artikel[]> {
  const url = `${GDELT_BASIS_URL}?query=${encodeURIComponent(abfrage.suchbegriff)}&mode=ArtList&maxrecords=75&format=json&timespan=${timespanMinuten}min`;
  const antwort = await fetchImpl(url);
  if (!antwort.ok) {
    throw new Error(`GDELT antwortete mit Status ${antwort.status}`);
  }
  const daten = (await antwort.json()) as { articles?: GdeltArtikelRoh[] } | null;
  const roh = daten?.articles ?? [];
  return roh
    .filter((a): a is Required<Pick<GdeltArtikelRoh, 'url' | 'title'>> & GdeltArtikelRoh => Boolean(a.url && a.title))
    .map((a) => ({
      id: kurzeHashId(a.url),
      quelle: quelleAusDomain(a.domain ?? 'unbekannt'),
      titel: a.title.trim(),
      teaser: a.title.trim(), // GDELT liefert keinen separaten Anriss
      url: a.url,
      bildUrl: a.socialimage || undefined,
      veroeffentlichtAm: gdeltDatumZuIso(a.seendate),
    }));
}
```

- [ ] **Step 5: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/sources/fetchGdelt.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 6: Typecheck + alle Tests**

Run: `cd pipeline && npm run typecheck && npm test`
Expected: alles grün.

- [ ] **Step 7: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): GDELT-Fetcher und Stichwort-Abfragen"
```

---

### Task 4: Speicher-Schnittstelle (ThemenStore) + In-Memory-Implementierung

**Files:**
- Create: `pipeline/src/store/store.ts`
- Create: `pipeline/src/store/memoryStore.ts`
- Test: `pipeline/test/store/memoryStore.test.ts`

**Interfaces:**
- Consumes: `VerarbeitetesThema` aus `../types.js`.
- Produces:
  - `store.ts`:
    ```ts
    export interface ThemenStore {
      speichern(thema: VerarbeitetesThema): Promise<void>;
      alle(): Promise<VerarbeitetesThema[]>;
      neuereAls(zeitstempel: string): Promise<VerarbeitetesThema[]>;
    }
    ```
  - `memoryStore.ts`: `export class SpeicherThemenStore implements ThemenStore`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Create `pipeline/test/store/memoryStore.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SpeicherThemenStore } from '../../src/store/memoryStore.js';
import type { VerarbeitetesThema } from '../../src/types.js';

function verarbeitetesThema(id: string, aktualisiert: string): VerarbeitetesThema {
  return { thema: { id, artikel: [], erstellt: aktualisiert, aktualisiert }, status: 'veroeffentlicht' };
}

describe('SpeicherThemenStore', () => {
  it('speichert und liest ein Thema wieder aus', async () => {
    const store = new SpeicherThemenStore();
    await store.speichern(verarbeitetesThema('t1', new Date().toISOString()));
    const alle = await store.alle();
    expect(alle).toHaveLength(1);
    expect(alle[0].thema.id).toBe('t1');
  });

  it('ueberschreibt ein Thema mit derselben ID statt es zu duplizieren', async () => {
    const store = new SpeicherThemenStore();
    await store.speichern(verarbeitetesThema('t1', '2026-01-01T00:00:00Z'));
    await store.speichern(verarbeitetesThema('t1', '2026-01-02T00:00:00Z'));
    const alle = await store.alle();
    expect(alle).toHaveLength(1);
    expect(alle[0].thema.aktualisiert).toBe('2026-01-02T00:00:00Z');
  });

  it('liefert bei neuereAls nur seitdem aktualisierte Themen', async () => {
    const store = new SpeicherThemenStore();
    await store.speichern(verarbeitetesThema('alt', '2026-01-01T00:00:00Z'));
    await store.speichern(verarbeitetesThema('neu', '2026-06-01T00:00:00Z'));
    const ergebnis = await store.neuereAls('2026-03-01T00:00:00Z');
    expect(ergebnis.map((v) => v.thema.id)).toEqual(['neu']);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/store/memoryStore.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 3: `pipeline/src/store/store.ts` implementieren**

```ts
import type { VerarbeitetesThema } from '../types.js';

export interface ThemenStore {
  speichern(thema: VerarbeitetesThema): Promise<void>;
  alle(): Promise<VerarbeitetesThema[]>;
  /** Themen, deren `aktualisiert`-Zeitstempel >= dem uebergebenen ISO-Zeitstempel ist. */
  neuereAls(zeitstempel: string): Promise<VerarbeitetesThema[]>;
}
```

- [ ] **Step 4: `pipeline/src/store/memoryStore.ts` implementieren**

```ts
import type { ThemenStore } from './store.js';
import type { VerarbeitetesThema } from '../types.js';

export class SpeicherThemenStore implements ThemenStore {
  private eintraege = new Map<string, VerarbeitetesThema>();

  async speichern(thema: VerarbeitetesThema): Promise<void> {
    this.eintraege.set(thema.thema.id, thema);
  }

  async alle(): Promise<VerarbeitetesThema[]> {
    return [...this.eintraege.values()];
  }

  async neuereAls(zeitstempel: string): Promise<VerarbeitetesThema[]> {
    return [...this.eintraege.values()].filter((v) => v.thema.aktualisiert >= zeitstempel);
  }
}
```

- [ ] **Step 5: Test + Typecheck**

Run: `cd pipeline && npx vitest run test/store/memoryStore.test.ts && npm run typecheck`
Expected: PASS (3 Tests), keine Typfehler.

- [ ] **Step 6: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): ThemenStore-Schnittstelle und In-Memory-Speicher"
```

---

### Task 5: Embeddings + Bündelung (Clustering)

**Files:**
- Create: `pipeline/src/cluster/embed.ts`
- Create: `pipeline/src/cluster/cluster.ts`
- Test: `pipeline/test/cluster/embed.test.ts`
- Test: `pipeline/test/cluster/cluster.test.ts`

**Interfaces:**
- Consumes: `Artikel`, `Thema` aus `../types.js`; `kurzeHashId` aus `../util/hash.js`.
- Produces:
  - `embed.ts`:
    ```ts
    export type EmbedFn = (texte: string[]) => Promise<number[][]>;
    export function erstelleGeminiEmbedFn(apiKey: string, fetchImpl?: typeof fetch): EmbedFn;
    ```
  - `cluster.ts`:
    ```ts
    export interface BuendelOptionen { embedFn?: EmbedFn; aehnlichkeitsSchwelle?: number; zeitfensterStunden?: number; }
    export function buendeln(neueArtikel: Artikel[], bestehendeThemen: Thema[], optionen?: BuendelOptionen): Promise<{ neueThemen: Thema[]; aktualisierteThemen: Thema[] }>;
    ```

- [ ] **Step 1: Fehlschlagenden Test für `embed.ts` schreiben**

Create `pipeline/test/cluster/embed.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { erstelleGeminiEmbedFn } from '../../src/cluster/embed.js';

describe('erstelleGeminiEmbedFn', () => {
  it('ruft fuer jeden Text die Embedding-API auf und gibt die Vektoren zurueck', async () => {
    const vektoren: Record<string, number[]> = { 'Text A': [1, 2, 3], 'Text B': [4, 5, 6] };
    const fetchImpl = vi.fn(async (_url: string, init: any) => {
      const text = JSON.parse(init.body).content.parts[0].text as string;
      return { ok: true, status: 200, json: async () => ({ embedding: { values: vektoren[text] } }) };
    }) as unknown as typeof fetch;

    const embedFn = erstelleGeminiEmbedFn('test-key', fetchImpl);
    expect(await embedFn(['Text A', 'Text B'])).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('wirft einen Fehler bei fehlerhafter Antwort', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429 })) as unknown as typeof fetch;
    await expect(erstelleGeminiEmbedFn('k', fetchImpl)(['x'])).rejects.toThrow('429');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/cluster/embed.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 3: `pipeline/src/cluster/embed.ts` implementieren**

```ts
export type EmbedFn = (texte: string[]) => Promise<number[][]>;

const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

export function erstelleGeminiEmbedFn(apiKey: string, fetchImpl: typeof fetch = fetch): EmbedFn {
  return async (texte: string[]) => {
    const ergebnisse: number[][] = [];
    for (const text of texte) {
      const antwort = await fetchImpl(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      });
      if (!antwort.ok) {
        throw new Error(`Gemini-Embedding antwortete mit Status ${antwort.status}`);
      }
      const daten = (await antwort.json()) as { embedding?: { values?: number[] } };
      ergebnisse.push(daten.embedding?.values ?? []);
    }
    return ergebnisse;
  };
}
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/cluster/embed.test.ts`
Expected: PASS (2 Tests).

- [ ] **Step 5: Fehlschlagenden Test für `cluster.ts` schreiben**

Create `pipeline/test/cluster/cluster.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buendeln } from '../../src/cluster/cluster.js';
import type { Artikel, Thema } from '../../src/types.js';

const qA = { id: 'quelle-a', name: 'A', typ: 'zeitung' as const, land: 'DE' as const, sprache: 'de' as const };
const qB = { id: 'quelle-b', name: 'B', typ: 'oeffentlich-rechtlich' as const, land: 'DE' as const, sprache: 'de' as const };

function art(o: Partial<Artikel>): Artikel {
  return { id: 'a', quelle: qA, titel: 'Titel', teaser: 'Teaser', url: 'https://x.de/1', veroeffentlichtAm: new Date().toISOString(), ...o };
}

describe('buendeln (Wortabgleich-Fallback, ohne embedFn)', () => {
  it('buendelt zwei Artikel mit aehnlicher Schlagzeile zu einem Thema', async () => {
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const { neueThemen } = await buendeln([a1, a2], []);
    expect(neueThemen).toHaveLength(1);
    expect(neueThemen[0].artikel).toHaveLength(2);
  });

  it('erstellt getrennte Themen fuer unzusammenhaengende Artikel', async () => {
    const a1 = art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident kam nach Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', titel: 'Grundsteuer in Nordrhein-Westfalen steigt deutlich', teaser: 'Die Landesregierung beschliesst neue Hebesaetze.' });
    const { neueThemen } = await buendeln([a1, a2], []);
    expect(neueThemen).toHaveLength(2);
  });

  it('haengt einen neuen Artikel an ein bestehendes Thema an', async () => {
    const jetzt = new Date().toISOString();
    const bestehend: Thema = {
      id: 'thema-1',
      artikel: [art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdbeben erschuettert Ostanatolien Region', teaser: 'Ein schweres Erdbeben traf die Region Ostanatolien.' })],
      erstellt: jetzt, aktualisiert: jetzt,
    };
    const neu = art({ id: 'a2', url: 'https://b.de/1', titel: 'Erdbeben in Ostanatolien Region fordert Opfer', teaser: 'Nach dem Erdbeben in der Region Ostanatolien steigt die Opferzahl.' });
    const { neueThemen, aktualisierteThemen } = await buendeln([neu], [bestehend]);
    expect(neueThemen).toHaveLength(0);
    expect(aktualisierteThemen).toHaveLength(1);
    expect(aktualisierteThemen[0].artikel).toHaveLength(2);
  });

  it('ignoriert bestehende Themen ausserhalb des 48h-Zeitfensters', async () => {
    const bestehend: Thema = {
      id: 'alt',
      artikel: [art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdbeben erschuettert Ostanatolien Region', teaser: 'Ein schweres Erdbeben traf die Region Ostanatolien.', veroeffentlichtAm: '2026-01-01T00:00:00Z' })],
      erstellt: '2026-01-01T00:00:00Z', aktualisiert: '2026-01-01T00:00:00Z',
    };
    const neu = art({ id: 'a2', url: 'https://b.de/1', titel: 'Erdbeben in Ostanatolien Region fordert Opfer', teaser: 'Nach dem Erdbeben in der Region Ostanatolien steigt die Opferzahl.', veroeffentlichtAm: new Date().toISOString() });
    const { neueThemen, aktualisierteThemen } = await buendeln([neu], [bestehend]);
    expect(aktualisierteThemen).toHaveLength(0);
    expect(neueThemen).toHaveLength(1);
  });
});

describe('buendeln (mit embedFn)', () => {
  it('nutzt die Embedding-Aehnlichkeit statt des Wortabgleichs', async () => {
    const vektoren = new Map<string, number[]>([
      ['Erdogan besucht Berlin. Treffen mit dem Kanzler.', [1, 0, 0]],
      ['Kanzler empfaengt Gast. Gespraech in der Hauptstadt.', [0.97, 0.03, 0]],
      ['Grundsteuer steigt. Neue Saetze im Bundesland.', [0, 1, 0]],
    ]);
    const embedFn = async (texte: string[]) => texte.map((t) => vektoren.get(t) ?? [0, 0, 1]);
    const a1 = art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdogan besucht Berlin', teaser: 'Treffen mit dem Kanzler.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', titel: 'Kanzler empfaengt Gast', teaser: 'Gespraech in der Hauptstadt.' });
    const a3 = art({ id: 'a3', url: 'https://c.de/1', titel: 'Grundsteuer steigt', teaser: 'Neue Saetze im Bundesland.' });
    const { neueThemen } = await buendeln([a1, a2, a3], [], { embedFn });
    expect(neueThemen).toHaveLength(2);
    const erdoganThema = neueThemen.find((t) => t.artikel.some((a) => a.id === 'a1'));
    expect(erdoganThema?.artikel.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });
});
```

- [ ] **Step 6: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/cluster/cluster.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 7: `pipeline/src/cluster/cluster.ts` implementieren**

```ts
import type { Artikel, Thema } from '../types.js';
import { kurzeHashId } from '../util/hash.js';
import type { EmbedFn } from './embed.js';

export interface BuendelOptionen {
  embedFn?: EmbedFn;
  /** Standard: 0.82 mit Embedding, 0.25 ohne (grober Wortabgleich). */
  aehnlichkeitsSchwelle?: number;
  /** Standard: 48. */
  zeitfensterStunden?: number;
}

function kosinusAehnlichkeit(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Vergleichstext eines Themas: die erste (urspruengliche) Meldung. Bleibt
 *  stabil, waehrend das Thema waechst -> verhindert Themendrift und haelt
 *  den Embedding-Cache gueltig. */
function themenText(thema: Thema): string {
  const erster = thema.artikel[0];
  return `${erster.titel}. ${erster.teaser}`;
}

function schlagwoerter(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3),
  );
}

function wortAehnlichkeit(a: string, b: string): number {
  const wa = schlagwoerter(a);
  const wb = schlagwoerter(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let schnitt = 0;
  for (const w of wa) if (wb.has(w)) schnitt++;
  return schnitt / Math.min(wa.size, wb.size);
}

function innerhalbZeitfenster(a: string, b: string, stunden: number): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= stunden * 3_600_000;
}

export async function buendeln(
  neueArtikel: Artikel[],
  bestehendeThemen: Thema[],
  optionen: BuendelOptionen = {},
): Promise<{ neueThemen: Thema[]; aktualisierteThemen: Thema[] }> {
  const schwelle = optionen.aehnlichkeitsSchwelle ?? (optionen.embedFn ? 0.82 : 0.25);
  const zeitfenster = optionen.zeitfensterStunden ?? 48;
  const jetzt = new Date().toISOString();

  const neueThemen: Thema[] = [];
  const aktualisierteThemen: Thema[] = [];
  const aktualisierteIds = new Set<string>();

  let cache: Map<string, number[]> | null = null;
  if (optionen.embedFn) {
    const texte = [
      ...bestehendeThemen.map(themenText),
      ...neueArtikel.map((a) => `${a.titel}. ${a.teaser}`),
    ];
    const vektoren = await optionen.embedFn(texte);
    cache = new Map(texte.map((t, i) => [t, vektoren[i]]));
  }

  const aehnlichkeit = (textA: string, textB: string): number => {
    if (cache) {
      const va = cache.get(textA);
      const vb = cache.get(textB);
      if (va && vb) return kosinusAehnlichkeit(va, vb);
    }
    return wortAehnlichkeit(textA, textB);
  };

  for (const artikel of neueArtikel) {
    const artikelText = `${artikel.titel}. ${artikel.teaser}`;
    const kandidaten: Thema[] = [
      ...bestehendeThemen.filter((t) => innerhalbZeitfenster(t.aktualisiert, artikel.veroeffentlichtAm, zeitfenster)),
      ...neueThemen,
    ];

    let bestesThema: Thema | null = null;
    let beste = 0;
    for (const kandidat of kandidaten) {
      const wert = aehnlichkeit(themenText(kandidat), artikelText);
      if (wert > beste) {
        beste = wert;
        bestesThema = kandidat;
      }
    }

    if (bestesThema && beste >= schwelle) {
      bestesThema.artikel.push(artikel);
      bestesThema.aktualisiert = jetzt;
      if (bestehendeThemen.includes(bestesThema) && !aktualisierteIds.has(bestesThema.id)) {
        aktualisierteIds.add(bestesThema.id);
        aktualisierteThemen.push(bestesThema);
      }
    } else {
      neueThemen.push({ id: kurzeHashId(`${artikel.url}-${jetzt}`), artikel: [artikel], erstellt: jetzt, aktualisiert: jetzt });
    }
  }

  return { neueThemen, aktualisierteThemen };
}
```

- [ ] **Step 8: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/cluster/`
Expected: PASS (embed 2 + cluster 5 Tests).

- [ ] **Step 9: Typecheck + alle Tests**

Run: `cd pipeline && npm run typecheck && npm test`
Expected: alles grün.

- [ ] **Step 10: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): Embeddings-Wrapper und Themen-Buendelung"
```

---

### Task 6: Zwei-Quellen-Filter (Unabhängigkeitsprüfung)

**Files:**
- Create: `pipeline/src/filter/independence.ts`
- Test: `pipeline/test/filter/independence.test.ts`

**Interfaces:**
- Consumes: `Thema` aus `../types.js`.
- Produces:
  ```ts
  export type Unabhaengigkeitsergebnis =
    | { status: 'ausreichend' }
    | { status: 'schwach'; grund: string }
    | { status: 'unzureichend'; grund: string };
  export function unabhaengigkeitPruefen(thema: Thema): Unabhaengigkeitsergebnis;
  ```

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Create `pipeline/test/filter/independence.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { unabhaengigkeitPruefen } from '../../src/filter/independence.js';
import type { Artikel, Thema } from '../../src/types.js';

const q = (id: string) => ({ id, name: id, typ: 'zeitung' as const, land: 'DE' as const, sprache: 'de' as const });
const art = (quelleId: string, teaser: string): Artikel => ({
  id: `a-${quelleId}`, quelle: q(quelleId), titel: 'T', teaser, url: `https://${quelleId}.de/1`, veroeffentlichtAm: new Date().toISOString(),
});
const thema = (artikel: Artikel[]): Thema => ({ id: 't', artikel, erstellt: '', aktualisiert: '' });

describe('unabhaengigkeitPruefen', () => {
  it('unzureichend bei nur einer Quelle', () => {
    expect(unabhaengigkeitPruefen(thema([art('zeit', 'Text')])).status).toBe('unzureichend');
  });

  it('ausreichend bei zwei verschiedenen Verlagen ohne Agenturbezug', () => {
    expect(unabhaengigkeitPruefen(thema([art('zeit', 'Eigener Bericht'), art('spiegel', 'Eigene Recherche')])).status).toBe('ausreichend');
  });

  it('schwach, wenn sich alle Quellen auf dieselbe Agentur berufen', () => {
    const ergebnis = unabhaengigkeitPruefen(thema([art('zeit', 'Meldung (dpa)'), art('spiegel', 'Bericht (dpa)')]));
    expect(ergebnis.status).toBe('schwach');
  });

  it('ausreichend, wenn mindestens eine Quelle nicht auf die Agentur verweist', () => {
    const ergebnis = unabhaengigkeitPruefen(thema([art('zeit', 'Meldung (dpa)'), art('spiegel', 'Eigene Recherche vor Ort')]));
    expect(ergebnis.status).toBe('ausreichend');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/filter/independence.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 3: `pipeline/src/filter/independence.ts` implementieren**

```ts
import type { Thema } from '../types.js';

export type Unabhaengigkeitsergebnis =
  | { status: 'ausreichend' }
  | { status: 'schwach'; grund: string }
  | { status: 'unzureichend'; grund: string };

const AGENTUR_MUSTER = /\((dpa|reuters|afp|ap|aa|anadolu|epd|kna)\)/i;

function agenturCredit(teaser: string): string | null {
  const treffer = teaser.match(AGENTUR_MUSTER);
  return treffer ? treffer[1].toLowerCase() : null;
}

export function unabhaengigkeitPruefen(thema: Thema): Unabhaengigkeitsergebnis {
  const verlage = new Set(thema.artikel.map((a) => a.quelle.id));
  if (verlage.size < 2) {
    return { status: 'unzureichend', grund: `Nur ${verlage.size} Quelle(n) berichten bisher.` };
  }

  const credits = thema.artikel.map((a) => agenturCredit(a.teaser));
  const alleGleicheAgentur = credits.every((c) => c !== null) && new Set(credits).size === 1;
  if (alleGleicheAgentur) {
    return { status: 'schwach', grund: `Alle Quellen berufen sich auf dieselbe Agentur (${credits[0]}).` };
  }

  return { status: 'ausreichend' };
}
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/filter/independence.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): Zwei-Quellen-Filter mit Agentur-Erkennung"
```

---

### Task 7: Gemini-Client, Prompt und Zusammenfassung (Schritt C)

**Files:**
- Create: `pipeline/src/summarize/geminiClient.ts`
- Create: `pipeline/src/summarize/prompt.ts`
- Create: `pipeline/src/summarize/summarize.ts`
- Test: `pipeline/test/summarize/geminiClient.test.ts`
- Test: `pipeline/test/summarize/prompt.test.ts`
- Test: `pipeline/test/summarize/summarize.test.ts`

**Interfaces:**
- Consumes: `Artikel`, `Thema`, `ThemenZusammenfassung` aus `../types.js`.
- Produces:
  - `geminiClient.ts`:
    ```ts
    export interface GeminiClient { strukturierteAntwort(prompt: string, schema: object): Promise<unknown>; }
    export function erstelleGeminiClient(apiKey: string, fetchImpl?: typeof fetch): GeminiClient;
    ```
  - `prompt.ts`:
    ```ts
    export const ZUSAMMENFASSUNGS_SCHEMA: object;
    export function promptErstellen(artikel: Artikel[]): string;
    ```
  - `summarize.ts`:
    ```ts
    export function themaZusammenfassen(thema: Thema, client: GeminiClient): Promise<ThemenZusammenfassung>;
    ```

- [ ] **Step 1: Fehlschlagenden Test für `geminiClient.ts` schreiben**

Create `pipeline/test/summarize/geminiClient.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { erstelleGeminiClient } from '../../src/summarize/geminiClient.js';

function fakeFetch(text: string, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok: status < 400, status,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  })) as unknown as typeof fetch;
}

describe('erstelleGeminiClient', () => {
  it('parst die strukturierte JSON-Antwort', async () => {
    const client = erstelleGeminiClient('k', fakeFetch(JSON.stringify({ hallo: 'welt' })));
    expect(await client.strukturierteAntwort('p', { type: 'object' })).toEqual({ hallo: 'welt' });
  });

  it('wirft einen Fehler bei fehlerhafter HTTP-Antwort', async () => {
    const client = erstelleGeminiClient('k', fakeFetch('', 500));
    await expect(client.strukturierteAntwort('p', {})).rejects.toThrow('500');
  });

  it('wirft einen Fehler, wenn kein Text in der Antwort steht', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    const client = erstelleGeminiClient('k', fetchImpl);
    await expect(client.strukturierteAntwort('p', {})).rejects.toThrow('keinen Text');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/summarize/geminiClient.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 3: `pipeline/src/summarize/geminiClient.ts` implementieren**

```ts
export interface GeminiClient {
  strukturierteAntwort(prompt: string, schema: object): Promise<unknown>;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export function erstelleGeminiClient(apiKey: string, fetchImpl: typeof fetch = fetch): GeminiClient {
  return {
    async strukturierteAntwort(prompt: string, schema: object): Promise<unknown> {
      const antwort = await fetchImpl(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
        }),
      });
      if (!antwort.ok) {
        throw new Error(`Gemini antwortete mit Status ${antwort.status}`);
      }
      const daten = (await antwort.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = daten.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini-Antwort enthielt keinen Text');
      }
      return JSON.parse(text);
    },
  };
}
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/summarize/geminiClient.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: Fehlschlagenden Test für `prompt.ts` schreiben**

Create `pipeline/test/summarize/prompt.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { promptErstellen } from '../../src/summarize/prompt.js';
import type { Artikel } from '../../src/types.js';

const quelle = { id: 'tagesschau', name: 'Tagesschau', typ: 'oeffentlich-rechtlich' as const, land: 'DE' as const, sprache: 'de' as const };

describe('promptErstellen', () => {
  it('enthaelt Kennung, Schlagzeile und Anriss jeder Quelle', () => {
    const artikel: Artikel[] = [{ id: 'a1', quelle, titel: 'Test-Schlagzeile', teaser: 'Test-Anriss', url: 'https://x.de/1', veroeffentlichtAm: new Date().toISOString() }];
    const prompt = promptErstellen(artikel);
    expect(prompt).toContain('"tagesschau"');
    expect(prompt).toContain('Test-Schlagzeile');
    expect(prompt).toContain('Test-Anriss');
  });

  it('weist die KI an, keine Fakten zu erfinden', () => {
    expect(promptErstellen([]).toLowerCase()).toContain('erfinde keine');
  });
});
```

- [ ] **Step 6: `pipeline/src/summarize/prompt.ts` implementieren**

```ts
import type { Artikel } from '../types.js';

export const ZUSAMMENFASSUNGS_SCHEMA = {
  type: 'object',
  properties: {
    schlagzeile: { type: 'string' },
    zusammenfassung: { type: 'string' },
    kategorieWerte: {
      type: 'object',
      properties: {
        deutschland: { type: 'number' },
        tuerkei: { type: 'number' },
        nahost: { type: 'number' },
      },
      required: ['deutschland', 'tuerkei', 'nahost'],
    },
    wichtigkeit: { type: 'number' },
    wichtigkeitBegruendung: { type: 'string' },
    fakten: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          belegtDurch: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'belegtDurch'],
      },
    },
    strittigePunkte: { type: 'array', items: { type: 'string' } },
    sicherheit: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] },
  },
  required: [
    'schlagzeile', 'zusammenfassung', 'kategorieWerte', 'wichtigkeit',
    'wichtigkeitBegruendung', 'fakten', 'strittigePunkte', 'sicherheit',
  ],
};

export function promptErstellen(artikel: Artikel[]): string {
  const quellenBlock = artikel
    .map(
      (a, i) => `Quelle ${i + 1} (Kennung: "${a.quelle.id}", Verlag: ${a.quelle.name}, Typ: ${a.quelle.typ}):
Schlagzeile: ${a.titel}
Anriss: ${a.teaser}
Veroeffentlicht: ${a.veroeffentlichtAm}`,
    )
    .join('\n\n');

  return `Du bist Redaktions-Assistent einer deutschen Nachrichten-App. Fasse das folgende Ereignis ausschliesslich auf Basis der untenstehenden Quellen zusammen.

STRENGE REGELN:
- Verwende NUR Informationen, die woertlich oder sinngemaess in den Quellen stehen. Erfinde keine Namen, Zahlen oder Daten.
- Wenn die Quellen fuer eine Aussage nicht ausreichen, schreibe das explizit statt zu raten.
- Wenn sich Quellen bei einer Angabe widersprechen, liste das unter "strittigePunkte" auf und formuliere die Zusammenfassung als "laut [Verlag] ... / laut [Verlag] ...".
- Jeder Eintrag in "fakten" muss im Feld "belegtDurch" die Kennung(en) der Quelle(n) enthalten, die genau diesen Fakt stuetzen. Nutze ausschliesslich die oben angegebenen Kennungen.
- Bewerte "kategorieWerte" fuer alle drei Kategorien unabhaengig (0-100): deutschland, tuerkei, nahost. Ein Ereignis kann fuer mehrere gleichzeitig relevant sein.
- Neutraler, sachlicher Ton. Keine eigene Wertung, kein Clickbait.
- Antworte auf Deutsch, auch wenn die Quellen in einer anderen Sprache sind.

QUELLEN:

${quellenBlock}`;
}
```

- [ ] **Step 7: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/summarize/prompt.test.ts`
Expected: PASS (2 Tests).

- [ ] **Step 8: Fehlschlagenden Test für `summarize.ts` schreiben**

Create `pipeline/test/summarize/summarize.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { themaZusammenfassen } from '../../src/summarize/summarize.js';
import type { GeminiClient } from '../../src/summarize/geminiClient.js';
import type { Thema } from '../../src/types.js';

const thema: Thema = {
  id: 'thema-1',
  artikel: [{
    id: 'a1',
    quelle: { id: 'zeit', name: 'Zeit', typ: 'zeitung', land: 'DE', sprache: 'de' },
    titel: 'Ereignis', teaser: 'Beschreibung', url: 'https://x.de/1', veroeffentlichtAm: new Date().toISOString(),
  }],
  erstellt: '', aktualisiert: '',
};

const gueltigeAntwort = {
  schlagzeile: 'Ereignis', zusammenfassung: 'Etwas ist passiert.',
  kategorieWerte: { deutschland: 70, tuerkei: 0, nahost: 0 },
  wichtigkeit: 50, wichtigkeitBegruendung: 'x',
  fakten: [{ text: 'Etwas ist passiert.', belegtDurch: ['zeit'] }],
  strittigePunkte: [], sicherheit: 'hoch',
};

function client(antwort: unknown): GeminiClient {
  return { strukturierteAntwort: async () => antwort };
}

describe('themaZusammenfassen', () => {
  it('gibt eine ThemenZusammenfassung mit gesetzter themaId zurueck', async () => {
    const ergebnis = await themaZusammenfassen(thema, client(gueltigeAntwort));
    expect(ergebnis.themaId).toBe('thema-1');
    expect(ergebnis.schlagzeile).toBe('Ereignis');
    expect(ergebnis.fakten[0].belegtDurch).toEqual(['zeit']);
  });

  it('wirft einen Fehler, wenn die Antwort nicht die erwartete Form hat', async () => {
    await expect(themaZusammenfassen(thema, client({ schlagzeile: 'nur das' }))).rejects.toThrow('Form');
  });
});
```

- [ ] **Step 9: `pipeline/src/summarize/summarize.ts` implementieren**

```ts
import type { Thema, ThemenZusammenfassung } from '../types.js';
import type { GeminiClient } from './geminiClient.js';
import { promptErstellen, ZUSAMMENFASSUNGS_SCHEMA } from './prompt.js';

function istGueltig(wert: unknown): wert is Omit<ThemenZusammenfassung, 'themaId'> {
  if (typeof wert !== 'object' || wert === null) return false;
  const w = wert as Record<string, unknown>;
  const kw = w.kategorieWerte as Record<string, unknown> | undefined;
  return (
    typeof w.schlagzeile === 'string' &&
    typeof w.zusammenfassung === 'string' &&
    typeof kw === 'object' && kw !== null &&
    typeof kw.deutschland === 'number' && typeof kw.tuerkei === 'number' && typeof kw.nahost === 'number' &&
    typeof w.wichtigkeit === 'number' &&
    typeof w.wichtigkeitBegruendung === 'string' &&
    Array.isArray(w.fakten) &&
    w.fakten.every((f: any) => typeof f?.text === 'string' && Array.isArray(f?.belegtDurch)) &&
    Array.isArray(w.strittigePunkte) &&
    (w.sicherheit === 'hoch' || w.sicherheit === 'mittel' || w.sicherheit === 'niedrig')
  );
}

export async function themaZusammenfassen(thema: Thema, client: GeminiClient): Promise<ThemenZusammenfassung> {
  const roh = await client.strukturierteAntwort(promptErstellen(thema.artikel), ZUSAMMENFASSUNGS_SCHEMA);
  if (!istGueltig(roh)) {
    throw new Error('Gemini-Antwort hat nicht die erwartete Form (ungueltige Zusammenfassung)');
  }
  return { ...roh, themaId: thema.id };
}
```

- [ ] **Step 10: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/summarize/`
Expected: PASS (geminiClient 3 + prompt 2 + summarize 2).

- [ ] **Step 11: Typecheck + alle Tests**

Run: `cd pipeline && npm run typecheck && npm test`
Expected: alles grün.

- [ ] **Step 12: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): Gemini-Client, Prompt und Themen-Zusammenfassung"
```

---

### Task 8: Fakten-Gegenprüfung (Schritt D)

**Files:**
- Create: `pipeline/src/verify/verify.ts`
- Test: `pipeline/test/verify/verify.test.ts`

**Interfaces:**
- Consumes: `Thema`, `ThemenZusammenfassung`, `Sicherheit` aus `../types.js`.
- Produces:
  ```ts
  export interface Pruefergebnis { gueltig: boolean; angepassteSicherheit: Sicherheit; probleme: string[]; }
  export function faktenPruefen(zusammenfassung: ThemenZusammenfassung, thema: Thema): Pruefergebnis;
  ```

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Create `pipeline/test/verify/verify.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { faktenPruefen } from '../../src/verify/verify.js';
import type { Thema, ThemenZusammenfassung } from '../../src/types.js';

const thema: Thema = {
  id: 't1',
  artikel: [
    { id: 'a1', quelle: { id: 'zeit', name: 'Zeit', typ: 'zeitung', land: 'DE', sprache: 'de' }, titel: 'T', teaser: 'x', url: 'https://a.de/1', veroeffentlichtAm: '' },
    { id: 'a2', quelle: { id: 'spiegel', name: 'Spiegel', typ: 'zeitung', land: 'DE', sprache: 'de' }, titel: 'T', teaser: 'x', url: 'https://b.de/1', veroeffentlichtAm: '' },
  ],
  erstellt: '', aktualisiert: '',
};

function zusammenfassung(fakten: ThemenZusammenfassung['fakten'], sicherheit: ThemenZusammenfassung['sicherheit'] = 'hoch'): ThemenZusammenfassung {
  return {
    themaId: 't1', schlagzeile: 'S', zusammenfassung: 'Z',
    kategorieWerte: { deutschland: 50, tuerkei: 0, nahost: 0 },
    wichtigkeit: 40, wichtigkeitBegruendung: 'x', fakten, strittigePunkte: [], sicherheit,
  };
}

describe('faktenPruefen', () => {
  it('gueltig, wenn jeder Fakt eine bekannte Beleg-Quelle hat', () => {
    const ergebnis = faktenPruefen(zusammenfassung([{ text: 'F1', belegtDurch: ['zeit'] }, { text: 'F2', belegtDurch: ['spiegel'] }]), thema);
    expect(ergebnis.gueltig).toBe(true);
    expect(ergebnis.angepassteSicherheit).toBe('hoch');
  });

  it('ungueltig und Sicherheit niedrig, wenn ein Fakt keine Beleg-Quelle hat', () => {
    const ergebnis = faktenPruefen(zusammenfassung([{ text: 'F1', belegtDurch: [] }]), thema);
    expect(ergebnis.gueltig).toBe(false);
    expect(ergebnis.angepassteSicherheit).toBe('niedrig');
    expect(ergebnis.probleme).toHaveLength(1);
  });

  it('ungueltig, wenn ein Fakt auf eine unbekannte Quelle verweist', () => {
    const ergebnis = faktenPruefen(zusammenfassung([{ text: 'F1', belegtDurch: ['erfunden'] }]), thema);
    expect(ergebnis.gueltig).toBe(false);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/verify/verify.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 3: `pipeline/src/verify/verify.ts` implementieren**

```ts
import type { Sicherheit, Thema, ThemenZusammenfassung } from '../types.js';

export interface Pruefergebnis {
  gueltig: boolean;
  angepassteSicherheit: Sicherheit;
  probleme: string[];
}

export function faktenPruefen(zusammenfassung: ThemenZusammenfassung, thema: Thema): Pruefergebnis {
  const bekannt = new Set(thema.artikel.map((a) => a.quelle.id));
  const probleme: string[] = [];

  for (const fakt of zusammenfassung.fakten) {
    if (fakt.belegtDurch.length === 0) {
      probleme.push(`Fakt ohne Beleg: "${fakt.text}"`);
      continue;
    }
    const unbekannt = fakt.belegtDurch.find((id) => !bekannt.has(id));
    if (unbekannt) {
      probleme.push(`Fakt "${fakt.text}" verweist auf unbekannte Quelle "${unbekannt}"`);
    }
  }

  return {
    gueltig: probleme.length === 0,
    angepassteSicherheit: probleme.length > 0 ? 'niedrig' : zusammenfassung.sicherheit,
    probleme,
  };
}
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/verify/verify.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): Fakten-Gegenpruefung gegen bekannte Quellen"
```

---

### Task 9: Kategorie-Regeln + Nahost-Sonderregel

**Files:**
- Create: `pipeline/src/rules/kategorien.ts`
- Create: `pipeline/src/rules/nahostRegel.ts`
- Test: `pipeline/test/rules/kategorien.test.ts`
- Test: `pipeline/test/rules/nahostRegel.test.ts`

**Interfaces:**
- Consumes: `KategorieWerte`, `Thema`, `ThemenZusammenfassung` aus `../types.js`.
- Produces:
  - `kategorien.ts`:
    ```ts
    export const KATEGORIE_SCHWELLE = 40;
    export type Kategorie = 'deutschland' | 'tuerkei' | 'nahost';
    export function gehoertZuKategorie(werte: KategorieWerte, kategorie: Kategorie, schwelle?: number): boolean;
    export function relevanteKategorien(werte: KategorieWerte, schwelle?: number): Kategorie[];
    ```
  - `nahostRegel.ts`:
    ```ts
    export interface NahostPruefung { betroffen: boolean; zurueckhalten: boolean; grund?: string; }
    export function nahostSonderregelPruefen(zusammenfassung: ThemenZusammenfassung, thema: Thema): NahostPruefung;
    ```

- [ ] **Step 1: Fehlschlagenden Test für `kategorien.ts` schreiben**

Create `pipeline/test/rules/kategorien.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { gehoertZuKategorie, relevanteKategorien } from '../../src/rules/kategorien.js';

describe('Kategorie-Regeln', () => {
  it('gehoertZuKategorie ist true ab Wert 40', () => {
    expect(gehoertZuKategorie({ deutschland: 40, tuerkei: 39, nahost: 0 }, 'deutschland')).toBe(true);
    expect(gehoertZuKategorie({ deutschland: 40, tuerkei: 39, nahost: 0 }, 'tuerkei')).toBe(false);
  });

  it('relevanteKategorien liefert alle Kategorien >= Schwelle (Erdogan-in-Berlin-Fall)', () => {
    expect(relevanteKategorien({ deutschland: 90, tuerkei: 95, nahost: 10 }).sort()).toEqual(['deutschland', 'tuerkei']);
  });

  it('relevanteKategorien kann leer sein', () => {
    expect(relevanteKategorien({ deutschland: 10, tuerkei: 5, nahost: 0 })).toEqual([]);
  });
});
```

- [ ] **Step 2: `pipeline/src/rules/kategorien.ts` implementieren**

```ts
import type { KategorieWerte } from '../types.js';

export const KATEGORIE_SCHWELLE = 40;

export type Kategorie = 'deutschland' | 'tuerkei' | 'nahost';

const ALLE: Kategorie[] = ['deutschland', 'tuerkei', 'nahost'];

export function gehoertZuKategorie(werte: KategorieWerte, kategorie: Kategorie, schwelle = KATEGORIE_SCHWELLE): boolean {
  return werte[kategorie] >= schwelle;
}

export function relevanteKategorien(werte: KategorieWerte, schwelle = KATEGORIE_SCHWELLE): Kategorie[] {
  return ALLE.filter((k) => gehoertZuKategorie(werte, k, schwelle));
}
```

- [ ] **Step 3: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/rules/kategorien.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 4: Fehlschlagenden Test für `nahostRegel.ts` schreiben**

Create `pipeline/test/rules/nahostRegel.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { nahostSonderregelPruefen } from '../../src/rules/nahostRegel.js';
import type { Artikel, Thema, ThemenZusammenfassung } from '../../src/types.js';

const q = (id: string) => ({ id, name: id, typ: 'zeitung' as const, land: 'INT' as const, sprache: 'en' as const });
const art = (id: string, quelleId: string): Artikel => ({ id, quelle: q(quelleId), titel: 'T', teaser: 'x', url: `https://${id}.x/1`, veroeffentlichtAm: '' });
const thema = (artikel: Artikel[]): Thema => ({ id: 't', artikel, erstellt: '', aktualisiert: '' });

function zf(over: Partial<ThemenZusammenfassung>): ThemenZusammenfassung {
  return {
    themaId: 't', schlagzeile: 'S', zusammenfassung: 'Neutrale Lage.',
    kategorieWerte: { deutschland: 0, tuerkei: 0, nahost: 80 },
    wichtigkeit: 70, wichtigkeitBegruendung: 'x', fakten: [], strittigePunkte: [], sicherheit: 'hoch',
    ...over,
  };
}

describe('nahostSonderregelPruefen', () => {
  it('nicht betroffen, wenn nahost-Wert unter 40', () => {
    const ergebnis = nahostSonderregelPruefen(zf({ kategorieWerte: { deutschland: 90, tuerkei: 0, nahost: 10 } }), thema([art('a1', 'x')]));
    expect(ergebnis.betroffen).toBe(false);
    expect(ergebnis.zurueckhalten).toBe(false);
  });

  it('betroffen, aber nicht zurueckgehalten ohne sensible Angabe', () => {
    const ergebnis = nahostSonderregelPruefen(zf({ zusammenfassung: 'Diplomatische Gespraeche wurden fortgesetzt.' }), thema([art('a1', 'x')]));
    expect(ergebnis).toEqual({ betroffen: true, zurueckhalten: false });
  });

  it('zurueckgehalten bei Opferzahlen ohne beide Seiten', () => {
    const ergebnis = nahostSonderregelPruefen(
      zf({ zusammenfassung: 'Bei dem Angriff gab es mehrere Tote und Verletzte.' }),
      thema([art('a1', 'al-jazeera'), art('a2', 'reuters-gdelt')]),
    );
    expect(ergebnis.zurueckhalten).toBe(true);
  });

  it('nicht zurueckgehalten bei Opferzahlen, wenn beide Seiten vertreten sind', () => {
    const ergebnis = nahostSonderregelPruefen(
      zf({ zusammenfassung: 'Bei dem Angriff gab es mehrere Tote.' }),
      thema([art('a1', 'al-jazeera'), art('a2', 'times-of-israel')]),
    );
    expect(ergebnis.zurueckhalten).toBe(false);
  });

  it('zurueckgehalten bei sensibler Angabe und niedriger Sicherheit', () => {
    const ergebnis = nahostSonderregelPruefen(
      zf({ zusammenfassung: 'Es gab Tote.', sicherheit: 'niedrig' }),
      thema([art('a1', 'al-jazeera'), art('a2', 'times-of-israel')]),
    );
    expect(ergebnis.zurueckhalten).toBe(true);
  });
});
```

- [ ] **Step 5: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/rules/nahostRegel.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 6: `pipeline/src/rules/nahostRegel.ts` implementieren**

```ts
import type { Thema, ThemenZusammenfassung } from '../types.js';

// Sensible Begriffe: Opfer/Schuld. Bewusst konservativ (lieber einmal zu oft
// zurueckhalten). Liste waechst mit Erfahrung.
const SENSIBLE_MUSTER = /(tote|toten|getoetet|opfer|opferzahl|verletzt|verantwortlich|schuld|massaker|kriegsverbrechen)/i;

// Quellen-Kennungen, die eine "Seite" abdecken. Waechst mit der Feed-Liste.
const ISRAELISCHE_QUELLEN = new Set(['times-of-israel', 'haaretz', 'jpost']);
const ARABISCH_KATARISCHE_QUELLEN = new Set(['al-jazeera', 'middle-east-eye', 'the-national']);

export interface NahostPruefung {
  betroffen: boolean;
  zurueckhalten: boolean;
  grund?: string;
}

export function nahostSonderregelPruefen(zusammenfassung: ThemenZusammenfassung, thema: Thema): NahostPruefung {
  if (zusammenfassung.kategorieWerte.nahost < 40) {
    return { betroffen: false, zurueckhalten: false };
  }

  const sensibel =
    SENSIBLE_MUSTER.test(zusammenfassung.zusammenfassung) ||
    zusammenfassung.fakten.some((f) => SENSIBLE_MUSTER.test(f.text));

  if (!sensibel) {
    return { betroffen: true, zurueckhalten: false };
  }

  if (zusammenfassung.sicherheit === 'niedrig') {
    return { betroffen: true, zurueckhalten: true, grund: 'Sensible Angabe bei niedriger Sicherheit.' };
  }

  const ids = new Set(thema.artikel.map((a) => a.quelle.id));
  const hatIsrael = [...ids].some((id) => ISRAELISCHE_QUELLEN.has(id));
  const hatArabisch = [...ids].some((id) => ARABISCH_KATARISCHE_QUELLEN.has(id));

  if (!hatIsrael || !hatArabisch) {
    return {
      betroffen: true,
      zurueckhalten: true,
      grund: 'Sensible Angabe (Opferzahlen/Schuldzuweisung), aber nicht beide Seiten unter den Quellen vertreten.',
    };
  }

  return { betroffen: true, zurueckhalten: false };
}
```

- [ ] **Step 7: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/rules/`
Expected: PASS (kategorien 3 + nahostRegel 5).

- [ ] **Step 8: Typecheck + alle Tests**

Run: `cd pipeline && npm run typecheck && npm test`
Expected: alles grün.

- [ ] **Step 9: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): Kategorie-Schwellen und Nahost-Sonderregel"
```

---

### Task 10: Pipeline-Orchestrierung (End-to-End)

**Files:**
- Create: `pipeline/src/pipeline.ts`
- Test: `pipeline/test/pipeline.test.ts`

**Interfaces:**
- Consumes: `buendeln`/`BuendelOptionen` (`./cluster/cluster.js`), `EmbedFn` (`./cluster/embed.js`), `unabhaengigkeitPruefen` (`./filter/independence.js`), `themaZusammenfassen` (`./summarize/summarize.js`), `GeminiClient` (`./summarize/geminiClient.js`), `faktenPruefen` (`./verify/verify.js`), `nahostSonderregelPruefen` (`./rules/nahostRegel.js`), `ThemenStore` (`./store/store.js`), Typen aus `./types.js`.
- Produces:
  ```ts
  export interface PipelineAbhaengigkeiten { store: ThemenStore; geminiClient: GeminiClient; embedFn?: EmbedFn; zeitfensterStunden?: number; }
  export interface PipelineErgebnis { verarbeitet: number; veroeffentlicht: number; zurueckgehalten: number; }
  export function pipelineLauf(neueArtikel: Artikel[], deps: PipelineAbhaengigkeiten): Promise<PipelineErgebnis>;
  ```

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Create `pipeline/test/pipeline.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { pipelineLauf } from '../src/pipeline.js';
import { SpeicherThemenStore } from '../src/store/memoryStore.js';
import { gehoertZuKategorie } from '../src/rules/kategorien.js';
import type { Artikel } from '../src/types.js';
import type { GeminiClient } from '../src/summarize/geminiClient.js';

const qA = { id: 'zeit', name: 'Zeit', typ: 'zeitung' as const, land: 'DE' as const, sprache: 'de' as const };
const qB = { id: 'tagesschau', name: 'Tagesschau', typ: 'oeffentlich-rechtlich' as const, land: 'DE' as const, sprache: 'de' as const };

function art(o: Partial<Artikel>): Artikel {
  return { id: 'a', quelle: qA, titel: 't', teaser: 'te', url: 'https://x.de/1', veroeffentlichtAm: new Date().toISOString(), ...o };
}
function fakeGemini(antwort: unknown): GeminiClient {
  return { strukturierteAntwort: vi.fn(async () => antwort) };
}

describe('pipelineLauf', () => {
  it('veroeffentlicht ein Thema mit >=2 Quellen und gueltiger Zusammenfassung, mehrfach kategorisiert', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const gemini = fakeGemini({
      schlagzeile: 'Erdogan trifft Kanzler in Berlin',
      zusammenfassung: 'Der tuerkische Praesident traf den Bundeskanzler in Berlin.',
      kategorieWerte: { deutschland: 90, tuerkei: 95, nahost: 5 },
      wichtigkeit: 80, wichtigkeitBegruendung: 'Staatsbesuch',
      fakten: [{ text: 'Erdogan traf den Kanzler in Berlin.', belegtDurch: ['zeit', 'tagesschau'] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini });

    expect(ergebnis.veroeffentlicht).toBe(1);
    expect(ergebnis.zurueckgehalten).toBe(0);
    const alle = await store.alle();
    expect(alle[0].status).toBe('veroeffentlicht');
    expect(gehoertZuKategorie(alle[0].zusammenfassung!.kategorieWerte, 'deutschland')).toBe(true);
    expect(gehoertZuKategorie(alle[0].zusammenfassung!.kategorieWerte, 'tuerkei')).toBe(true);
    expect(gehoertZuKategorie(alle[0].zusammenfassung!.kategorieWerte, 'nahost')).toBe(false);
  });

  it('haelt ein Thema mit nur einer Quelle zurueck, ohne Gemini aufzurufen', async () => {
    const store = new SpeicherThemenStore();
    const gemini = fakeGemini({});
    const ergebnis = await pipelineLauf([art({ id: 'a1', url: 'https://a.de/1', quelle: qA })], { store, geminiClient: gemini });
    expect(ergebnis.zurueckgehalten).toBe(1);
    expect(ergebnis.veroeffentlicht).toBe(0);
    expect(gemini.strukturierteAntwort).not.toHaveBeenCalled();
  });

  it('haelt ein Thema zurueck, wenn ein Fakt keine Beleg-Quelle hat', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Ereignis X Bericht', teaser: 'Beschreibung X ausfuehrlich' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Ereignis X passiert Bericht', teaser: 'Beschreibung X sehr ausfuehrlich' });
    const gemini = fakeGemini({
      schlagzeile: 'Ereignis X', zusammenfassung: 'Etwas ist passiert.',
      kategorieWerte: { deutschland: 60, tuerkei: 0, nahost: 0 },
      wichtigkeit: 50, wichtigkeitBegruendung: 'x',
      fakten: [{ text: 'Unbelegter Fakt', belegtDurch: [] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini });

    expect(ergebnis.zurueckgehalten).toBe(1);
    const alle = await store.alle();
    expect(alle[0].zusammenfassung?.sicherheit).toBe('niedrig');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `cd pipeline && npx vitest run test/pipeline.test.ts`
Expected: FAIL – Modul nicht gefunden.

- [ ] **Step 3: `pipeline/src/pipeline.ts` implementieren**

```ts
import type { Artikel } from './types.js';
import type { ThemenStore } from './store/store.js';
import type { GeminiClient } from './summarize/geminiClient.js';
import type { EmbedFn } from './cluster/embed.js';
import { buendeln } from './cluster/cluster.js';
import { unabhaengigkeitPruefen } from './filter/independence.js';
import { themaZusammenfassen } from './summarize/summarize.js';
import { faktenPruefen } from './verify/verify.js';
import { nahostSonderregelPruefen } from './rules/nahostRegel.js';

export interface PipelineAbhaengigkeiten {
  store: ThemenStore;
  geminiClient: GeminiClient;
  embedFn?: EmbedFn;
  zeitfensterStunden?: number;
}

export interface PipelineErgebnis {
  verarbeitet: number;
  veroeffentlicht: number;
  zurueckgehalten: number;
}

export async function pipelineLauf(
  neueArtikel: Artikel[],
  deps: PipelineAbhaengigkeiten,
): Promise<PipelineErgebnis> {
  const zeitfenster = deps.zeitfensterStunden ?? 48;
  const grenze = new Date(Date.now() - zeitfenster * 3_600_000).toISOString();
  const bestehende = (await deps.store.neuereAls(grenze)).map((v) => v.thema);

  const { neueThemen, aktualisierteThemen } = await buendeln(neueArtikel, bestehende, {
    embedFn: deps.embedFn,
    zeitfensterStunden: zeitfenster,
  });

  const zuVerarbeiten = [...neueThemen, ...aktualisierteThemen];
  let veroeffentlicht = 0;
  let zurueckgehalten = 0;

  for (const thema of zuVerarbeiten) {
    const unabhaengigkeit = unabhaengigkeitPruefen(thema);
    if (unabhaengigkeit.status === 'unzureichend') {
      await deps.store.speichern({ thema, status: 'wartet', grund: unabhaengigkeit.grund });
      zurueckgehalten++;
      continue;
    }

    const zusammenfassung = await themaZusammenfassen(thema, deps.geminiClient);
    const pruefung = faktenPruefen(zusammenfassung, thema);
    const gepruefte = { ...zusammenfassung, sicherheit: pruefung.angepassteSicherheit };

    if (!pruefung.gueltig) {
      await deps.store.speichern({ thema, zusammenfassung: gepruefte, status: 'zurueckgehalten', grund: pruefung.probleme.join('; ') });
      zurueckgehalten++;
      continue;
    }

    const nahost = nahostSonderregelPruefen(gepruefte, thema);
    if (nahost.zurueckhalten) {
      await deps.store.speichern({ thema, zusammenfassung: gepruefte, status: 'zurueckgehalten', grund: nahost.grund });
      zurueckgehalten++;
      continue;
    }

    if (unabhaengigkeit.status === 'schwach' && gepruefte.sicherheit !== 'hoch') {
      await deps.store.speichern({ thema, zusammenfassung: gepruefte, status: 'zurueckgehalten', grund: unabhaengigkeit.grund });
      zurueckgehalten++;
      continue;
    }

    await deps.store.speichern({ thema, zusammenfassung: gepruefte, status: 'veroeffentlicht' });
    veroeffentlicht++;
  }

  return { verarbeitet: zuVerarbeiten.length, veroeffentlicht, zurueckgehalten };
}
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `cd pipeline && npx vitest run test/pipeline.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: Typecheck + alle Tests**

Run: `cd pipeline && npm run typecheck && npm test`
Expected: alles grün.

- [ ] **Step 6: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): End-to-End-Orchestrierung der Pipeline"
```

---

### Task 11: Lokaler CLI-Runner

**Files:**
- Create: `pipeline/src/cli.ts`
- Modify: `pipeline/package.json` (Skript `pipeline:run`, Abhängigkeiten `dotenv`, `tsx`)
- Create: `pipeline/README.md`

**Interfaces:**
- Consumes: `feeds`/`feedAbrufen`, `gdeltAbfragen`/`gdeltAbrufen`, `SpeicherThemenStore`, `erstelleGeminiClient`, `erstelleGeminiEmbedFn`, `pipelineLauf`.
- Produces: ausführbares Skript, kein importierbares API.

- [ ] **Step 1: Abhängigkeiten installieren**

Run: `cd pipeline && npm install dotenv && npm install -D tsx`
Expected: `package.json` enthält `dotenv` unter `dependencies` und `tsx` unter `devDependencies`.

- [ ] **Step 2: `pipeline/package.json` um Skript ergänzen**

In `"scripts"` hinzufügen:
```json
"pipeline:run": "tsx src/cli.ts"
```

- [ ] **Step 3: `pipeline/src/cli.ts` implementieren**

```ts
import 'dotenv/config';
import type { Artikel } from './types.js';
import { feeds } from './sources/feeds.js';
import { feedAbrufen } from './sources/fetchRss.js';
import { gdeltAbfragen, gdeltAbrufen } from './sources/fetchGdelt.js';
import { SpeicherThemenStore } from './store/memoryStore.js';
import { erstelleGeminiClient } from './summarize/geminiClient.js';
import { erstelleGeminiEmbedFn } from './cluster/embed.js';
import { pipelineLauf } from './pipeline.js';

async function sammle<T>(
  aufgaben: { name: string; lauf: () => Promise<Artikel[]> }[],
): Promise<Artikel[]> {
  const ergebnisse = await Promise.allSettled(aufgaben.map((a) => a.lauf()));
  const artikel: Artikel[] = [];
  ergebnisse.forEach((e, i) => {
    if (e.status === 'fulfilled') {
      artikel.push(...e.value);
      console.log(`  ok   ${aufgaben[i].name}: ${e.value.length} Artikel`);
    } else {
      console.warn(`  FEHL ${aufgaben[i].name}: ${e.reason}`);
    }
  });
  return artikel;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY fehlt. Bitte pipeline/.env aus .env.example anlegen.');
    process.exit(1);
  }

  console.log(`RSS-Feeds (${feeds.length}):`);
  const rss = await sammle(feeds.map((f) => ({ name: f.quelle.id, lauf: () => feedAbrufen(f) })));

  console.log(`GDELT-Abfragen (${gdeltAbfragen.length}):`);
  const gdelt = await sammle(gdeltAbfragen.map((a) => ({ name: a.kategorie, lauf: () => gdeltAbrufen(a) })));

  const alle = [...rss, ...gdelt];
  console.log(`\n${alle.length} Artikel gesammelt. Starte Pipeline ...\n`);

  const store = new SpeicherThemenStore();
  const ergebnis = await pipelineLauf(alle, {
    store,
    geminiClient: erstelleGeminiClient(apiKey),
    embedFn: erstelleGeminiEmbedFn(apiKey),
  });

  console.log('Ergebnis:', ergebnis, '\n');
  for (const t of await store.alle()) {
    const titel = t.zusammenfassung?.schlagzeile ?? t.thema.artikel[0]?.titel ?? '(ohne Titel)';
    console.log(`[${t.status}] ${titel}`);
    if (t.zusammenfassung) {
      const k = t.zusammenfassung.kategorieWerte;
      console.log(`   Kategorien D:${k.deutschland} T:${k.tuerkei} N:${k.nahost} | Wichtigkeit ${t.zusammenfassung.wichtigkeit} | Sicherheit ${t.zusammenfassung.sicherheit}`);
    }
    if (t.grund) console.log(`   Grund: ${t.grund}`);
  }
}

main().catch((fehler) => {
  console.error('Pipeline-Lauf fehlgeschlagen:', fehler);
  process.exit(1);
});
```

- [ ] **Step 4: `pipeline/README.md` schreiben**

```markdown
# newsapp – Pipeline (Plan 1)

Lokal lauffähige Kern-Pipeline: sammelt Nachrichten (RSS + GDELT), bündelt sie
zu Themen, filtert schwach belegte heraus und erzeugt mit Google Gemini eine
geprüfte, mehrfach kategorisierte deutsche Zusammenfassung.

## Voraussetzungen

- Node.js ≥ 20
- Kostenloser Gemini-API-Schlüssel: https://aistudio.google.com/apikey

## Einrichtung

```bash
cd pipeline
npm install
cp .env.example .env      # dann GEMINI_API_KEY in .env eintragen
```

## Tests

```bash
npm test          # alle Unit-Tests (kein Netz nötig)
npm run typecheck # TypeScript-Prüfung
```

## Einen echten Lauf ausführen

```bash
npm run pipeline:run
```

Ruft die echten Feeds und GDELT ab und lässt Gemini die Themen zusammenfassen.
Die Ausgabe listet pro Thema Status (veröffentlicht / zurückgehalten / wartet),
Kategorie-Werte, Wichtigkeit und Sicherheit.

## Bekannte Grenzen von Plan 1

- **Keine Persistenz:** Jeder Lauf startet mit leerem Speicher (In-Memory).
  Dauerhafte Speicherung + 30-Minuten-Takt kommen in Plan 2 (Cloudflare D1 +
  GitHub Actions).
- Feed-URLs in `src/sources/feeds.ts` sind Startwerte – beim ersten echten
  Lauf prüfen, welche Feeds antworten, und die Liste anpassen.
```

- [ ] **Step 5: Alle Tests + Typecheck (Regression)**

Run: `cd pipeline && npm run typecheck && npm test`
Expected: alle Tests grün (Summe aller Tasks).

- [ ] **Step 6: Manueller Lauf gegen echte Feeds**

Voraussetzung: `pipeline/.env` mit gültigem `GEMINI_API_KEY`, Internetzugang.
Run: `cd pipeline && npm run pipeline:run`
Expected:
- Liste der RSS-Feeds mit „ok"/„FEHL" je Feed (einzelne Fehlschläge sind ok).
- „N Artikel gesammelt. Starte Pipeline ..." mit N > 0.
- „Ergebnis: { verarbeitet, veroeffentlicht, zurueckgehalten }".
- Danach pro Thema eine Zeile `[status] Schlagzeile` mit Kategorie-Werten.

Falls ein Feed dauerhaft „FEHL" meldet: URL in `src/sources/feeds.ts` prüfen/korrigieren, erneut ausführen. Diese Korrekturen im selben Commit festhalten.

- [ ] **Step 7: Commit**

```bash
git add pipeline
git commit -m "feat(pipeline): lokaler CLI-Runner und README"
```

---

## Self-Review

**Spec-Abdeckung (Abschnitt 2–4 + 6 der Spec, soweit Plan 1 betreffend):**

| Spec-Anforderung | Task |
|---|---|
| Sammeln: RSS-Feeds je Kategorie | Task 2 |
| Sammeln: GDELT als zweite Bestätigungsquelle | Task 3 |
| Quellen-Attribute (`typ`, `land`, `sprache`) | Task 1 (Typ `Quelle`), Task 2 (feeds.ts) |
| Bündeln: Embedding-Ähnlichkeit + Wortabgleich-Fallback + 48-h-Fenster | Task 5 |
| Bündeln: bekanntes Thema aktualisieren statt neu | Task 5 (`aktualisierteThemen`), Task 10 |
| Zwei-Quellen-Regel + schwache Agentur-Bestätigung | Task 6, Task 10 |
| Gemini-Zusammenfassung mit strengen Regeln + strukturierter Ausgabe | Task 7 |
| Keine Volltexte an die KI | Task 7 (`promptErstellen` nutzt nur `teaser`), Global Constraints |
| Mehrfach-Kategorisierung (0–100 je Kategorie) | Task 7 (Schema), Task 9 (`relevanteKategorien`) |
| Kategorie-Schwelle ≥ 40 | Task 9 |
| Fakten-Gegenprüfung: jeder Fakt braucht Beleg-Quelle, sonst „niedrig" + zurückhalten | Task 8, Task 10 |
| Nahost-Sonderregel (beide Seiten, Sicherheit) | Task 9, Task 10 |
| Grundprinzip „lieber nichts als etwas Falsches" (zurückhalten, nicht löschen) | Task 10 (`status: 'wartet' \| 'zurueckgehalten'`) |
| Lokale Testbarkeit ohne Cloud | Task 11 |

**Nicht in Plan 1 (bewusst, siehe Abschnitt „Umfang"):** D1-Persistenz, GitHub-Actions-Takt, Fehler-Benachrichtigung, Betreiber-Dashboard, Push, PWA-Frontend, Bilder-Anzeige, Medienschau, Impressum. → Plan 2 & 3.

**Platzhalter-Scan:** keine „TBD"/„TODO"/„später"; jeder Code-Schritt enthält vollständigen Code; jeder Test-Schritt enthält echten Testcode.

**Typ-Konsistenz geprüft:** `Artikel`, `Quelle`, `Feed`, `Thema`, `ThemenZusammenfassung`, `Fakt` (`belegtDurch`), `KategorieWerte` (`deutschland`/`tuerkei`/`nahost`), `Sicherheit` (`hoch`/`mittel`/`niedrig`), `VerarbeitetesThema`/`Verarbeitungsstatus` (`wartet`/`zurueckgehalten`/`veroeffentlicht`) – einheitlich in Task 1 definiert und in Tasks 2–11 identisch verwendet. Store-Methoden `speichern`/`alle`/`neuereAls` – konsistent in Task 4, 10, 11. `buendeln` gibt `{ neueThemen, aktualisierteThemen }` – so konsumiert in Task 10. `unabhaengigkeitPruefen` → `status: 'ausreichend'|'schwach'|'unzureichend'` – so verzweigt in Task 10.
