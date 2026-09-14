# NEWSSPUR – Stand & nächste Schritte

## Echte Push-Benachrichtigungen (2026-09-14)

Die Glocken-Schaltfläche + das Einstellungs-Sheet aus dem Mockup waren rein
kosmetisch (keine Funktion) – jetzt echt umgesetzt:
- **Architektur:** Abo-Speicherung läuft über den Cloudflare Worker
  (natives D1-Binding, neue Tabelle `push_abos`), das Versenden passiert aus
  der Pipeline heraus (Node/GitHub Actions, `web-push`-Paket), direkt nach
  jeder Veröffentlichung – neuer optionaler `pushBenachrichtiger`-Hook in
  `pipeline.ts`, exakt nach dem Muster von `socialPoster` (Fehler pro Abo
  werden nur geloggt, brechen nichts ab).
- **Auslöse-Kriterien:** `wichtigkeit >= 70` als Basis-Schwelle,
  „Nur Eilmeldungen"-Abos zusätzlich `sicherheit === 'hoch'` und
  `wichtigkeit >= 90`, plus passendes Kategorie-Toggle. Beide Schwellen sind
  grob geschätzt (noch keine echte Wichtigkeits-Verteilung aus Live-Läufen
  vorhanden) – bei Bedarf leicht nachjustierbar in `pipeline/src/push/auswahl.ts`.
  Bewusster Trade-off: keine harte "5 pro Tag"-Zähl-Tabelle, nur die hohe
  Schwelle hält das Mockup-Versprechen näherungsweise ein (YAGNI, analog zur
  Reaktionen-Entscheidung).
- **iOS-Voraussetzung:** Web Push funktioniert auf dem iPhone nur, wenn
  newsspur.de vorher über Safari-Teilen → „Zum Home-Bildschirm" installiert
  und von dort geöffnet wurde. Dafür neu: `web/public/manifest.json`,
  `web/public/icons/icon-192.png` + `icon-512.png` (per resvg aus einem
  einfachen NEWSSPUR-Icon erzeugt), `web/public/sw.js` (Service Worker).
- 79 Pipeline-Tests grün (vorher 66), 16 Web-Tests grün (vorher 11).
- **Offen:** D1-Migration für `push_abos` auf die lebende Datenbank
  anwenden, `wrangler deploy`, danach auf einem echten iPhone testen
  (Home-Bildschirm-Installation → Aktivieren-Button im Glocken-Sheet).

**Letzter Stand:** 2026-09-13 – NEWSSPUR ist live unter der echten Domain:
**https://newsspur.de** (Fallback weiterhin: https://newsspur.newsspur.workers.dev)

**Repo:** jetzt zusätzlich **privat auf GitHub**: github.com/newsspur-rgb/newsspur
(lokal weiterhin `~/Desktop/newsspur`, Branch `main`). Früher im
gemeinsamen `~/Desktop/newsapp` – der wurde am 2026-09-03 aufgeteilt:
NEWSSPUR → `~/Desktop/newsspur`, Bora-Chat → `~/Desktop/bora`,
Kids-Channel → `~/Desktop/kids-channel`. Der alte `~/Desktop/newsapp`
existiert noch als Backup und kann gelöscht werden.

## Plan 2 (Automatisierung) – Teil 1 „Motor" ERLEDIGT (2026-09-13)

- **GitHub Actions** (`.github/workflows/pipeline.yml`) lässt die Pipeline
  jetzt automatisch alle 30 Minuten laufen (plus manueller Testlauf per
  `gh workflow run pipeline.yml`). Repo ist **privat**, Zugangsdaten liegen
  ausschließlich als verschlüsselte GitHub-Secrets vor
  (`GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`,
  `CLOUDFLARE_API_TOKEN`).
- **Cloudflare D1** (Datenbank `newsspur`, EU-Zuständigkeit) ersetzt den
  flüchtigen In-Memory-Store: `pipeline/src/store/d1Store.ts` implementiert
  `ThemenStore` fetch-basiert gegen die D1-REST-API, Schema bewusst ein
  JSON-Blob pro Thema (`pipeline/src/store/schema.sql`, Phase-1-YAGNI).
  `cli.ts` nutzt D1 automatisch, wenn die drei Cloudflare-Variablen gesetzt
  sind, sonst weiterhin In-Memory (lokales Testen unverändert möglich).
- **Erster echter Cloud-Lauf verifiziert:** 242 Artikel gesammelt, 7 Meldungen
  veröffentlicht, 214 warten auf zweite Quelle – direkt in D1 nachgeprüft
  (`SELECT status, COUNT(*) ... GROUP BY status`).
- **Bug gefunden + behoben:** Ein einzelner 503-Fehler von Gemini (kommt bei
  Google gelegentlich vor) ließ bisher den **kompletten Lauf** abbrechen, auch
  wenn andere Themen erfolgreich gewesen wären. `pipeline.ts` überspringt
  jetzt nur das betroffene Thema (neues Feld `PipelineErgebnis.fehler`),
  nächster 30-Minuten-Lauf versucht es erneut. 54 Tests grün (vorher 48).
- Aus der (pausierten) Instagram-Recherche liegen `satori`/`@resvg/resvg-js`
  + Google-Fonts bereits im Repo (`pipeline/assets/fonts/`), ungenutzt.
- **GDELT weiterhin nicht erreichbar** – jetzt auch in GitHub Actions
  (`TypeError: fetch failed`), nicht nur lokal. RSS allein liefert mit 242
  Artikeln pro Lauf genug Material, daher kein Blocker; Ursache noch nicht
  untersucht (evtl. IP-Sperre/Endpunkt-Änderung bei GDELT).

## Echte Fotos, Quellenlinks, Disclaimer + Reaktionen (2026-09-14)

Auf Nutzer-Vorbildern (Boulevard-Instagram-Post mit Foto, News-App „DU" mit
Scroll-Artikel: Foto, Quelle+Link, Reaktions-Emojis, Disclaimer) basierend
umgesetzt:
- **Web (newsspur.de):** `bildUrl`/`url` pro Artikel wurden von der Pipeline
  zwar schon immer gesammelt, aber nie weitergereicht – jetzt zeigt die
  Detail- und Karten-Ansicht das echte Quellfoto (`web/src/aufbereiten.ts`,
  `web/public/index.html`) statt Farbverlauf-Platzhalter, und die
  „Alle Quellen"-Links sind jetzt echt anklickbar statt tot (`href='#'`).
- **Disclaimer:** statischer Hinweistext in der Detail-Ansicht (KI-Charakter,
  im Zweifel Original-Quellen prüfen).
- **Reaktions-Leiste:** neue Tabelle `reaktionen` in D1, neue Route
  `POST /api/reaktion` (`web/src/index.ts`), 5 Emoji-Buttons in der
  Detail-Ansicht. Bewusster Trade-off: nur clientseitiger Schutz vor
  Mehrfach-Klicks (`localStorage`), kein Server-Login/Captcha – Zähler sind
  ein kosmetisches Stimmungsbild, kein belastbares Voting.
  **Offen:** Migration muss einmalig auf die lebende D1-Datenbank
  angewendet werden (`wrangler d1 execute newsspur --remote ...`), bevor die
  Reaktionen live funktionieren.
- **Instagram-Karte:** `renderCard.ts` bekommt bei vorhandenem Quellfoto ein
  Foto-Layout (Foto oben, Schlagzeile darunter, Credit-Zeile „Foto: <Quelle>");
  jeder Ladefehler (404/Timeout) fällt automatisch auf die bisherige
  reine Text-Karte zurück, kein Abbruch. 66 Tests grün (vorher 64).
- **Bewusst zurückgestellt** (keine generische Datenquelle in RSS/GDELT):
  automatisch generierte Balkendiagramme (z. B. Wahlergebnisse) und
  eingebettetes Video aus der Quelle. Als Backlog-Idee vermerkt, falls
  später eine strukturierte Quelle dafür gefunden wird.

## Instagram-Zugang dauerhaft verbunden (2026-09-13)

Meta-App **„NEWSSPUR Automation"** (App-ID `4444054755854406`) angelegt, Facebook-Seite
**„Newsspur"** erstellt und mit dem Instagram-Business-Konto `@newsspur` verknüpft
(Business-Portfolio „NEWSSPUR" in business.facebook.com). Anwendungsfall „Nachrichten
und Inhalte auf Instagram verwalten" → API-Setup mit **Facebook-Login** (nicht das
default Instagram-Login-Setup, das andere Berechtigungsnamen hat) mit
`instagram_basic` + `instagram_content_publish` ausgestattet. Daraus ein
60-Tage-Seiten-Token erzeugt (Kurzzeit-Token aus Graph API Explorer → Long-Lived-User-Token
per `oauth/access_token` → Page-Access-Token aus `/me/accounts`, dieser läuft nicht ab,
solange die Seiten-Verknüpfung besteht) und die Instagram-Business-Account-ID
(`17841425545062305`) ermittelt. Beides als GitHub-Secrets `INSTAGRAM_ACCESS_TOKEN` /
`INSTAGRAM_BUSINESS_ACCOUNT_ID` hinterlegt und in `.github/workflows/pipeline.yml`
verdrahtet – der 30-Minuten-Lauf postet damit ab sofort automatisch auf Instagram
(vorher war der Code aus dem 13.9.-Commit zwar fertig, aber mangels Secrets inaktiv).
**Offen:** Der Page-Token ist zwar langlebig, aber nicht ewig gültig (Meta kann ihn
ungültig machen, z. B. bei Passwortänderung/Rechte-Entzug) – bei Fehlschlägen im
Actions-Log ist eine Token-Erneuerung über denselben Weg nötig.

## Plan 2, Teil 2 „Webseite" ERLEDIGT (2026-09-13)

- **Live:** https://newsspur.newsspur.workers.dev – zeigt echte, automatisch
  erzeugte Meldungen, nicht mehr die Mockup-Beispiele.
- Neuer Code in `web/`: ein einzelner Cloudflare Worker mit Static Assets
  (aktueller Cloudflare-Standard, ersetzt getrennt Pages+Workers) liefert die
  Seite aus UND beantwortet `/api/themen` per nativem D1-Binding.
  `web/src/aufbereiten.ts` löst Quellen-IDs zu Klarnamen auf, dedupliziert
  Quellen, markiert staatsnahe mit Flag.
- **Bewusst nicht vorgetäuscht:** Medienschau, Zeitverlauf, „Wer sagt was",
  Poster-Bilder erzeugt die echte Pipeline nicht – diese Mockup-Felder
  bleiben leer/ausgeblendet, bis es echte Daten dafür gibt.
- **Bug gefunden + behoben:** Dem Mockup fehlten DOCTYPE/`<html>`/`<head>`/
  `<meta charset="utf-8">` komplett – beim lokalen Öffnen als Datei fiel das
  nicht auf, auf der echten Domain wurden Umlaute als Mojibake angezeigt
  („TÃ¼RKEI" statt „TÜRKIYE"). Jetzt korrekt, dabei auch gleich „Türkei" →
  „Türkiye" (aktuelle offizielle Bezeichnung) geändert.
- Deploy bisher **manuell** (`cd web && npx wrangler deploy`) – nach jedem
  Pipeline- oder Frontend-Update von Hand nötig, noch nicht automatisiert.

## Eigene Domain ERLEDIGT (2026-09-13)

`newsspur.de` läuft jetzt direkt auf der echten Webseite. Ablauf: Domain als
Zone bei Cloudflare hinzugefügt (bestehende E-Mail-Einträge MX/TXT/CNAME
automatisch übernommen), Nameserver bei IONOS auf `andy.ns.cloudflare.com` /
`lola.ns.cloudflare.com` umgestellt (Umstellung war ungewöhnlich schnell,
Minuten statt Stunden), alte IONOS-A/AAAA-Einträge für `newsspur.de` und
`www` gelöscht (blockierten sonst die automatische Verknüpfung), dann
`routes` mit `custom_domain: true` in `web/wrangler.jsonc` ergänzt und per
`wrangler deploy` verknüpft – alles per Cloudflare-API/CLI, kein
Dashboard-Geklicke nötig außer für den einmaligen DNS-Edit-Token
(`CLOUDFLARE_DNS_TOKEN` in `~/api-keys.env`). `www.newsspur.de` läuft ebenso.
`*.workers.dev`-Adresse bleibt als Fallback aktiv (`workers_dev: true`).

**Nächste Schritte:** Push-Benachrichtigungen, danach echte Medienschau/
Zeitverlauf/„Wer sagt was"-Daten + Kiosk-Poster, sobald die Pipeline diese
Felder liefert. Automatischer Deploy bei jedem Push wäre ebenfalls noch offen.

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
   (Iran-Außenamtssprecher Baqaei via X, CENTCOM-Sprecher Hawkins, unabhängiger
   Waffenexperte Trevor Ball/Bellingcat via BBC Verify). Direkter X/Twitter-
   Zugriff über agent-reach war zunächst nicht verfügbar (twitter-cli nicht
   installiert, OpenCLI-Browser-Erweiterung nicht verbunden) – deshalb zuerst
   Exa-Websuche als Ausweichlösung. Nachdem der Nutzer die OpenCLI-Erweiterung
   installiert und sich bei X eingeloggt hat (2026-09-13), funktioniert der
   direkte X-Zugriff (siehe [[agent-reach-twitter-x]]) – Iran- und Bellingcat-
   Zitat wurden danach auf die echten Original-Tweet-Links umgestellt
   (x.com/IRIMFA_SPOX/status/2039615242099933190 bzw.
   x.com/Easybakeovensz/status/2039130094929613148 – echter Handle von Trevor
   Ball, nicht der zunächst vermutete). Das CENTCOM-Statement bleibt bewusst
   über den BBC-Artikel verlinkt – das war ohnehin ein offizielles
   Pressestatement und kein X-Post.
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
