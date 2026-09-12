# NEWSSPUR – Stand & nächste Schritte

**Letzter Stand:** 2026-09-12 – Pipeline-Echtlauf erfolgreich

**Repo:** eigenständig unter `~/Desktop/newsspur` (Branch `main`). Früher im
gemeinsamen `~/Desktop/newsapp` – der wurde am 2026-09-03 aufgeteilt:
NEWSSPUR → `~/Desktop/newsspur`, Bora-Chat → `~/Desktop/bora`,
Kids-Channel → `~/Desktop/kids-channel`. Der alte `~/Desktop/newsapp`
existiert noch als Backup und kann gelöscht werden.

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
- Demo ohne Key läuft: `npm run pipeline:demo` – zieht die echten Feeds von heute (DE/TR/Nahost kommen rein). Ohne Key gruppiert die Pipeline nur per Wortabgleich und macht dabei Fehler (paart teils Unzusammenhängendes) – Feinschliff offen.
- **2026-09-12: Erster echter End-to-End-Lauf mit Gemini-Key erfolgreich.**
  `npm run pipeline:run` in `pipeline/`: 264 Artikel gesammelt (9 RSS-Feeds,
  GDELT liefert in dieser Umgebung 429/Netzwerkfehler – Fallback greift wie
  vorgesehen), 235 verarbeitet, 12 Meldungen mit echter Gemini-Zusammenfassung
  veröffentlicht, Rest wartet korrekt auf eine zweite unabhängige Quelle.
  Nahost-Sonderregel griff sichtbar (z. B. "Huthi-Vormarsch im Jemen" mit
  weniger Quellen aber hoher Nahost-Kategorie durchgelassen).
  Dabei drei echte Bugs gefunden und behoben (Modelle waren von Google
  inzwischen abgekündigt/umbenannt):
  - `pipeline/src/cluster/embed.ts`: Modell `text-embedding-004` gibt 404 →
    auf `gemini-embedding-001` umgestellt.
  - Google-Free-Tier erlaubt nur 100 Embedding-Anfragen/Minute (zählt auch
    innerhalb eines Batch-Aufrufs pro Text) → `embed.ts` batcht jetzt in
    100er-Gruppen, wartet zwischen Batches und liest bei 429 die von Google
    genannte `retryDelay` aus der Fehlerantwort statt blind zu raten.
  - `pipeline/src/summarize/geminiClient.ts`: Modell `gemini-2.5-flash` ist
    für neue Nutzer nicht mehr verfügbar (404, Google empfiehlt Nachfolger) →
    auf `gemini-3.6-flash` umgestellt (unterstützt weiterhin `responseSchema`).
  Tests entsprechend angepasst/ergänzt: jetzt 48 grün (vorher 46).
  **Praktische Folge:** ein Pipeline-Lauf mit ~250 Artikeln dauert wegen der
  Minutenlimit-Pausen jetzt 2–3 Minuten statt Sekunden – für einen
  automatisierten Cron-Lauf (Plan 2) unproblematisch, für manuelles Testen
  etwas Geduld nötig.

### 3. Design-Mockup – IN ARBEIT
- Datei: `docs/mockup/newsspur-mockup.html` (dieselbe wie das Artifact)
- Artifact: https://claude.ai/code/artifact/e0797246-d18d-4701-8d6b-537857e3487d
- **Name:** NEWSSPUR + Claim „Kein Blatt vor dem Mund" (roter Streifen unter dem Logo)
- **Design-Richtung:** „Laut & direkt / Boulevard-Kante" – Schwarz/Weiß + Scharlachrot, hoher Kontrast
- **Schrift:** Oswald (schmal, wuchtig, Kiosk) für Schlagzeilen/Masthead/Tabs; Hanken Grotesk Fließtext; IBM Plex Mono für Metadaten
- Inhalt: 5 Beispiel-Meldungen, Kategorie-Tabs, Detail-Ansicht mit Fakten+Belegen / Strittige Punkte / Zeitverlauf / Medienschau / Quellenliste, „So arbeitet NEWSSPUR"-Sheet, Push-Sheet, Hell/Dunkel

## Nächste Schritte

1. **„Wer sagt was"-Beispiel im Mockup – ERLEDIGT (2026-09-12).** Neue Detail-
   Sektion `wer_sagt_was` in `docs/mockup/newsspur-mockup.html`, gerendert
   zwischen „Strittige Punkte" und „Zeitverlauf" (CSS-Klassen `.statements`/
   `.stmt-*`). Dafür wurde die bisherige fiktive Platzhalter-Meldung
   `nahost-chan-junis` durch ein reales, per Exa-Websuche recherchiertes
   Ereignis ersetzt (jetzt `id: 'nahost-lamerd'`): der US-Raketenangriff auf
   Lamerd/Iran am 28.2.2026, mit drei echten, verlinkten Original-Statements
   (Iran-Außenamtssprecher Baghaei via X, CENTCOM-Sprecher Hawkins, unabhängiger
   Waffenexperte Trevor Ball/Bellingcat via BBC Verify). Direkter X/Twitter-
   Zugriff über agent-reach war nicht verfügbar (twitter-cli nicht installiert,
   OpenCLI-Browser-Erweiterung nicht verbunden) – deshalb Exa-Websuche als
   Ausweichlösung, Zitate/Daten/Links stammen aus verifizierbaren Presseartikeln
   (BBC, The Hill, Breaking Defense, Press TV, AP), keine erfundenen Zitate.
   Mit isoliertem Headless-Chrome-Profil (kein echtes Nutzerprofil) als
   Screenshot geprüft; ein Kontrast-Bug im Dunkelmodus (Akteur-Chip unsichtbar,
   `--ink` ist im Dark-Theme hell) dabei gefunden und behoben.
2. **Bild-Kacheln als Vektor-Grafik** (Nutzer hat Weg B gewählt): pro Post ein bold Kiosk-Poster-Motiv im Schwarz/Weiß/Rot-Look
   - erdogan-berlin → Brandenburger Tor
   - stromsteuer → Strommast
   - tuerkei-inflation → Absturz-Kurve / ₺
   - ruestungsexporte → gestempelte Kiste
   - nahost-lamerd → bleibt bewusst ohne Bild
   - Umsetzung: `POSTER`-Objekt mit Inline-SVG im Skript; in `card()` und `openDetail()` statt `thumb.classList.add('ph-'+…)` ein `insertAdjacentHTML('afterbegin', POSTER[s.bild])`; CSS `.ph-*` raus, `.thumb svg,.d-hero svg{display:block;width:100%;height:100%}` rein; `credit` → „Illustration: NEWSSPUR"
3. Mockup final abnehmen
4. Plan 2 (Automatisierung: GitHub Actions + Cloudflare + Push) planen

## Ideen/Backlog (noch nicht geplant, nur festgehalten – 2026-09-12)

- Hochwertigeres Design mit passenden Animationen fürs Zusammenfassen der
  Live-Meldungen
- Durchgängige, sichtbare Quellenangaben (Original-Quelle + Link) bei jeder
  Zusammenfassung/jedem Statement – journalistische Transparenz. Bewusst
  **keine** Bilder von fremden Nachrichtenseiten übernehmen (Urheberrecht) –
  deshalb eigene Vektor-Illustrationen statt echter Fotos (siehe Poster-Punkt oben)
- Neues Feature: in Deutschland beschlossene und wieder aufgehobene/gekippte
  Gesetze verfolgen (mögliche Gratis-Quelle: DIP – Dokumentations- und
  Informationssystem für Parlamentarische Vorgänge des Bundestags, offene API)
- Neues Feature: Zusammenfassungen von Bundestags-Reden/-Debatten (Gratis-
  Quelle: Plenarprotokolle des Bundestags, öffentlich einsehbar)
