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
- **GDELT** (`api.gdeltproject.org`) war aus der Entwicklungsumgebung nicht
  erreichbar (Timeout). Der Code fängt das sauber ab (die Pipeline läuft dann
  nur mit den RSS-Feeds weiter). Beim echten Lauf im eigenen Netz prüfen, ob
  GDELT erreichbar ist; sonst als reine RSS-Pipeline betreiben.
- Getestete, funktionierende Feeds (Stand Ersteinrichtung): tagesschau, zeit,
  spiegel, dw-tuerkisch, trt-haber, bbc-tuerkce, bbc-nahost, al-jazeera,
  times-of-israel.
