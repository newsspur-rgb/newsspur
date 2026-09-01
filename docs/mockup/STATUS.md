# NEWSSPUR – Stand & nächste Schritte

**Letzter Stand:** 2026-09-01 (abends) – „morgen weiter"

## Wo wir stehen

### 1. Konzept / Spec – fertig & freigegeben
- `docs/superpowers/specs/2026-09-01-news-pwa-design.md`
- Vollautomatische KI-Pipeline, PWA-Prototyp, 0 € (nur Gratis-Stufen), Deutsch zuerst
- Kategorien: Deutschland / Türkei / Nahost-Konflikt (Mehrfach-Zuordnung, Schwelle ≥ 40)
- Weg B: GitHub Actions + Cloudflare + Google Gemini

### 2. Plan 1 – Pipeline-Kern – IMPLEMENTIERT
- Plan: `docs/superpowers/plans/2026-09-01-plan1-pipeline-kern.md`
- Code: `pipeline/` – 11 Aufgaben umgesetzt, 46 Unit-Tests grün, Typecheck sauber
- Läuft lokal: `cd pipeline && npm install && cp .env.example .env` (Gemini-Key eintragen) `&& npm run pipeline:run`
- RSS-Abruf gegen echte Feeds verifiziert (7–9 Quellen liefern). GDELT aus der Umgebung nicht erreichbar (Code fängt es ab).
- **Offen:** echter End-to-End-Lauf mit Gemini-Key (braucht der Nutzer), dann Branch mergen.
- Hinweis: Es lief parallel eine zweite Claude-Sitzung am `pipeline/`-Code (Branch `chore/nahost-schwelle-konstante`, Refactor + `pipeline/src/demo.ts`). Branch-Stand morgen klären.

### 3. Design-Mockup – IN ARBEIT
- Datei: `docs/mockup/newsspur-mockup.html` (dieselbe wie das Artifact)
- Artifact: https://claude.ai/code/artifact/e0797246-d18d-4701-8d6b-537857e3487d
- **Name:** NEWSSPUR + Claim „Kein Blatt vor dem Mund" (roter Streifen unter dem Logo)
- **Design-Richtung:** „Laut & direkt / Boulevard-Kante" – Schwarz/Weiß + Scharlachrot, hoher Kontrast
- **Schrift:** Oswald (schmal, wuchtig, Kiosk) für Schlagzeilen/Masthead/Tabs; Hanken Grotesk Fließtext; IBM Plex Mono für Metadaten
- Inhalt: 5 Beispiel-Meldungen, Kategorie-Tabs, Detail-Ansicht mit Fakten+Belegen / Strittige Punkte / Zeitverlauf / Medienschau / Quellenliste, „So arbeitet NEWSSPUR"-Sheet, Push-Sheet, Hell/Dunkel

## Nächste Schritte (morgen)

1. **Bild-Kacheln als Vektor-Grafik** (Nutzer hat Weg B gewählt): pro Post ein bold Kiosk-Poster-Motiv im Schwarz/Weiß/Rot-Look
   - erdogan-berlin → Brandenburger Tor
   - stromsteuer → Strommast
   - tuerkei-inflation → Absturz-Kurve / ₺
   - ruestungsexporte → gestempelte Kiste
   - nahost-chan-junis → bleibt bewusst ohne Bild
   - Umsetzung: `POSTER`-Objekt mit Inline-SVG im Skript; in `card()` und `openDetail()` statt `thumb.classList.add('ph-'+…)` ein `insertAdjacentHTML('afterbegin', POSTER[s.bild])`; CSS `.ph-*` raus, `.thumb svg,.d-hero svg{display:block;width:100%;height:100%}` rein; `credit` → „Illustration: NEWSSPUR"
2. Mockup final abnehmen
3. Zurück zur Pipeline: Plan 1 End-to-End-Lauf, dann Plan 2 (Automatisierung/Cloud) planen
