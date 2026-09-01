# Design: Automatische Nachrichten‑PWA (Arbeitstitel „newsapp")

**Datum:** 2026-09-01
**Status:** Freigegeben (Brainstorming), Umsetzungsplan folgt
**Phase:** 1 – kostenloser PWA‑Prototyp

---

## 1. Ziel & Kontext

Eine Nachrichten‑App im Stil von *deinupdate.de*: sehr kurze, einfach erklärte
Meldungen, Karten‑Feed, Push. Unterschied zu DeinUpdate: die Zusammenfassungen
entstehen **vollautomatisch per KI**, nicht durch eine Redaktion.

**Kategorien:** Hauptfeed („News im Vordergrund") + drei Filter: Deutschland,
Türkei, Nahost‑Konflikt.

**Sprache:** Deutsch zuerst. Architektur so gebaut, dass Türkisch später
ergänzt werden kann (Originalsprache wird gespeichert).

### Rahmenbedingungen

| Punkt | Entscheidung |
|---|---|
| Kosten | 0 € laufend (nur Gratis‑Kontingente) |
| Zielbild | Echter Produkt‑Launch – aber Phase 1 ist Prototyp; Recht, native App und bezahlte Stufen sind bewusst auf Phase 3 verschoben |
| Wer baut | Claude baut, Nutzer testet und gibt Feedback (Nutzer programmiert nicht) |
| Plattform | PWA (Web‑App, installierbar). Native App = spätere Phase |

### Phasen

1. **Phase 1 (jetzt, 0 €):** PWA‑Prototyp, vollautomatische Pipeline mit
   eingebauter Qualitätssicherung.
2. **Phase 2:** Testen mit Nutzer + kleinem Kreis, Qualität bewerten.
3. **Phase 3 (kostenpflichtig):** Recht klären (Impressum, Haftung,
   Leistungsschutzrecht), native App, bezahlte Stufen, ggf. Redaktion.

### Bewusst NICHT in Phase 1 (YAGNI)

- Nutzerkonten / Login
- Personalisierung über Kategorie‑Auswahl hinaus
- Kommentare, Teilen‑Feed, soziale Funktionen
- Native App / App‑Store
- Mehr als drei Kategorien
- Volltext‑Speicherung von Artikeln
- KI‑generierte Meinungen/Stimmungsbilder

---

## 2. Architektur (Weg B: GitHub + Cloudflare + Gemini)

Drei Teile:

```
┌─ 1. MOTOR (GitHub Actions, alle 30 Min) ─────────────────┐
│  a) SAMMELN    RSS-Feeds + GDELT abrufen                  │
│  b) BÜNDELN    Gleiche Ereignisse gruppieren              │
│  c) FILTERN    Nur Themen mit ≥ 2 unabhängigen Quellen    │
│  d) KI         Gemini: zusammenfassen + Widersprüche      │
│                prüfen + Kategorie-Werte + Wichtigkeit     │
│  e) SPEICHERN  In die Datenbank schreiben                 │
│  f) PUSH       Bei Wichtigkeit > Schwelle: Benachrichtigung│
└──────────────────────┬───────────────────────────────────┘
                       │
              ┌────────▼─────────┐
              │  2. DATENBANK    │  Cloudflare D1 (SQLite)
              └────────┬─────────┘
                       │
       ┌───────────────▼────────────────┐
       │  3. WEB-APP (PWA, Cloudflare)   │
       │  Pages (Frontend) + Workers (API)│
       └────────────────────────────────┘
```

### Kostenstellen (alle 0 €)

| Baustein | Dienst | Gratis‑Grenze | Bemerkung |
|---|---|---|---|
| Motor | GitHub Actions | Privates Repo: 2 000 Min/Monat | Takt 30 Min. Öffentliches Repo = unbegrenzt (später Option). Repo braucht alle ~60 Tage Aktivität → automatischer Keep‑alive‑Commit |
| KI (Zusammenfassung) | Google Gemini API (Flash) | ~250–1 500 Anfragen/Tag, keine Kreditkarte | Pessimistisch mit 250/Tag rechnen |
| KI (Einbettungen fürs Bündeln) | Gemini Embeddings | eigenes Kontingent | Fallback: Schlagzeilen‑Wortabgleich ohne KI |
| Datenbank | Cloudflare D1 | 5 GB, 5 Mio. Lesevorgänge/Tag | reicht deutlich |
| Frontend | Cloudflare Pages | unbegrenzte Requests, 500 Builds/Monat | |
| API | Cloudflare Workers | 100 000 Requests/Tag | |
| Push | Web Push (VAPID, selbst gehostet) | kostenlos | |

**Portabilität:** Die Pipeline‑Logik ist unabhängig vom Ort. Wenn Gemini‑Qualität
nicht reicht oder Limits stören → KI‑Schritt auf anderen Anbieter/Ort umziehbar,
Rest bleibt.

### Datentakt

- Neuer Lauf alle 30 Min.
- Ein Thema bleibt ~48 h im Feed, danach Archiv.
- Bekanntes Thema wird aktualisiert, nicht neu zusammengefasst (höchstens alle
  paar Stunden bei echter Entwicklung).

---

## 3. Nachrichtenquellen

### Feed‑Aufbau

Hauptansicht (alle Themen nach Wichtigkeit) + drei Filter‑Tabs: Deutschland,
Türkei, Nahost‑Konflikt.

### RSS‑Quellen je Kategorie (kostenlos, kein Limit, kein Schlüssel)

**Deutschland**
- Tagesschau (inkl. Themen‑Feeds Inland/Ausland + Eilmeldungen)
- Deutschlandfunk Nachrichten, ZDFheute
- ntv, Zeit Online, Spiegel Schlagzeilen, Süddeutsche, FAZ, taz

**Türkei**
- DW Türkçe, BBC Türkçe (unabhängig finanziert)
- Anadolu Ajansı, TRT Haber (staatsnah – aufgenommen, aber als solche markiert)
- Bianet, Cumhuriyet (unabhängig / oppositionsnah)

**Nahost‑Konflikt**
- BBC Middle East, UN News Nahost, DW
- Al Jazeera (katarisch), Times of Israel (israelisch), Middle East Eye (kritisch)
- Bewusst mehrere Seiten (israelisch + arabisch + neutral)

Exakte Feed‑URLs werden bei der Umsetzung geprüft und in **einer Konfigurationsdatei**
gepflegt (neue Quelle = eine Zeile, kein Code‑Umbau).

### GDELT (Ergänzung)

GDELT DOC 2.0 API (kostenlos, kein Schlüssel, ~15‑Min‑Aktualität). Durchsucht alle
30 Min weltweit Nachrichtenseiten nach Stichwortlisten je Kategorie. Liefert
Schlagzeile, Link, Sprache, Herkunftsland. Dient als zweite Bestätigungsquelle.

### Sprachen

Türkische/arabische Quellen werden von Gemini auf Deutsch zusammengefasst.
Originalsprache + Original‑Link werden gespeichert.

### Quell‑Markierungen

Jede Quelle trägt Attribute: `verlag`, `land`, `typ` (öffentlich‑rechtlich /
zeitung / agentur / staatsnah / unabhängig), `sprache`. Wird für die
Unabhängigkeits‑Prüfung und für Transparenz‑Hinweise genutzt.

---

## 4. KI‑Verarbeitung

### Schritt A – Bündeln (vor der KI)

Jeder Artikel → „Zahlen‑Fingerabdruck" (Gemini‑Einbettung von Schlagzeile +
Teaser). Ähnliche Fingerabdrücke im 48‑h‑Fenster = ein Thema.
**Fallback ohne KI:** Schlagzeilen‑Wortüberschneidung + Zeitfenster + gemeinsame
Eigennamen.

### Schritt B – Unabhängigkeits‑Prüfung

Thema wird nur weiterverarbeitet bei **≥ 2 Quellen von verschiedenen Verlagen**.
Wenn beide nur dieselbe Agentur (dpa/Reuters/AP) nachdrucken → schwache
Bestätigung, Thema wartet auf echte dritte Quelle.

### Schritt C – Eine Gemini‑Anfrage pro Thema

**Eingabe:** nur Schlagzeile + Teaser + Quelle + Zeit + Link jedes Artikels
(keine Volltexte).

**Ausgabe (strukturiert / JSON):**

| Feld | Inhalt |
|---|---|
| `schlagzeile` | sachlich, kein Clickbait |
| `zusammenfassung` | 2–4 Sätze, nur aus den Teasern |
| `kategorie_werte` | { deutschland: 0–100, tuerkei: 0–100, nahost: 0–100 } |
| `wichtigkeit` | 0–100 + Begründung |
| `fakten` | Liste, jeder Fakt mit `belegt_durch: [Quellen]` |
| `strittige_punkte` | wo Quellen sich widersprechen |
| `sicherheit` | hoch / mittel / niedrig |

**Feste Regeln im KI‑Auftrag:**
- Nichts ergänzen, was nicht in den Teasern steht. Reichen die Teaser nicht →
  „Faktenlage unklar", nicht raten.
- Zahlen, Namen, Daten nie erfinden.
- Strittige Angaben immer als „laut A … / laut B …".
- Neutraler Ton, keine Wertung.

### Schritt D – Gegenprüfung (Code, keine KI)

Der Code prüft: Hat **jeder** Fakt mindestens eine Beleg‑Quelle? Wenn nein →
Sicherheit auf „niedrig", Thema wird **zurückgehalten** (nicht gelöscht), bis
mehr Quellen da sind.

### Kategorisierung: mehrfach, nicht einfach

Die KI vergibt je Kategorie einen Relevanzwert 0–100.

| Beispiel | Deutschland | Türkei | Nahost |
|---|---|---|---|
| „Erdoğan besucht Berlin, trifft Kanzler" | 90 | 95 | 10 |
| „Bundestag debattiert Waffenlieferungen an Israel" | 85 | 5 | 90 |
| „Erdbeben in Ostanatolien" | 5 | 95 | 5 |
| „Neue Grundsteuer in NRW" | 95 | 0 | 0 |

**Anzeige‑Logik:**
- Hauptfeed: alle Themen nach Wichtigkeit, jedes einmal.
- Kategorie‑Tab: Thema erscheint, wenn sein Wert für diese Kategorie **≥ 40**.
- Ein Thema kann in 0–3 Tabs sein. Schwelle 40 ist eine Einstellung (justierbar).

### Sonderregel Nahost

Themen mit Opferzahlen oder Schuldzuweisungen:
- immer Dauerhinweis „Angaben unterscheiden sich je nach Quelle"
- beide Seiten müssen vorkommen, sonst zurückgehalten
- bei Sicherheit „niedrig" → nicht anzeigen, bis Lage klarer
- greift auch bei Überschneidung Türkei ↔ Nahost

### Schritt E – Push

Nur bei Wichtigkeit > 75 **und** Sicherheit „hoch" **und** ≥ 3 Quellen.
Maximal 5 Push‑Nachrichten/Tag. Nutzer kann pro Kategorie Push ab‑/anschalten.

### Kosten‑Abschätzung

~50–150 Themen/Tag × 1 Anfrage → unter dem pessimistischen Gemini‑Limit (250/Tag).
Bekannte Themen werden aktualisiert statt neu zusammengefasst.

### Medienschau + Umfragen (eigener Block im Themen‑Detail)

Pro großem Thema: echte Kommentar‑Überschriften + je 1 kurzes Zitat aus
**namentlich genannten** deutschen Medien über das politische Spektrum, jeweils
verlinkt. Plus Umfragedaten mit Quelle, wenn vorhanden. **Die App zitiert nur,
wertet nie selbst.** Kein KI‑generiertes Stimmungsbild.

---

## 5. Die App (PWA)

### Bildschirme

1. **Hauptfeed** – Tabs: Alle · Deutschland · Türkei · Nahost
2. **Kategorie‑Tab** – gefilterter Feed (Relevanz ≥ 40)
3. **Themen‑Detail** – siehe unten
4. **Einstellungen** – Push an/aus, Push‑Kategorien, Textgröße, Hell/Dunkel
5. **Über / Impressum / Datenschutz** + „Wie diese App arbeitet"

### Feed‑Karte

Bild (+ „Foto: Quelle") · Kategorie‑Chips · Schlagzeile · 1‑Satz‑Anriss ·
„4 Quellen · vor 20 Min · 🤖 auto".

### Themen‑Detail

- Volle Zusammenfassung
- Fakten‑Liste mit „belegt durch: …"
- Strittige Punkte (farblich abgesetzt)
- Zeitverlauf bei Updates
- Medienschau + Umfragen
- Alle Quellen mit Direkt‑Links
- Dauerhinweis bei Nahost‑Themen

### Bilder

- **Nicht kopieren, nur verweisen** (`<img src>` zeigt auf Quell‑Server).
- Immer sichtbarer Bildnachweis.
- Fallback: Kategorie‑farbige Kachel mit Schlagzeile, wenn Bild fehlt/kaputt.
- Keine KI‑Bilder für echte Ereignisse; nur für Kategorie‑Grafiken.
- Optionaler Bild‑Proxy über Cloudflare erst, wenn direktes Verweisen Probleme
  macht (Referer‑Sperren / Mixed Content).
- In der Datenbank nur die Bild‑Adresse, nie das Bild.

### Aussehen

Kartenbasiert, viel Weißraum, große klare Schrift, feste Farbe je Kategorie,
Hell‑/Dunkelmodus, mobil zuerst.

### PWA‑Verhalten

- Installierbar; auf iPhone nötig für Push (iOS ≥ 16.4, „Zum Home‑Bildschirm").
- Letzter Feed offline lesbar.
- Kein Login zum Lesen. Push‑Abo anonym (nur Geräte‑Token, kein Konto, keine Mail).

### Onboarding

3 Schritte: Kategorien wählen → Push erlauben? → fertig.

---

## 6. Qualitätssicherung, Fehler & Tests

### Fehlerbehandlung

| Problem | Reaktion |
|---|---|
| RSS‑Feed antwortet nicht | Überspringen, nächster Lauf erneut. Nach 5 Fehlern in Folge → Meldung an Betreiber |
| GDELT/Gemini nicht erreichbar | Lauf bricht sauber ab, letzter Stand bleibt. Nächster Lauf in 30 Min |
| Gemini‑Tageslimit erreicht | Neue Themen in Warteschlange, am Folgetag zuerst verarbeitet. Feed bleibt mit vorhandenem Stand aktuell |
| KI liefert ungültiges Ergebnis | Verwerfen, Thema zurückhalten, ein Wiederholungsversuch nächster Lauf |
| Bild‑Link tot | Fallback‑Kachel |
| Pipeline‑Lauf stürzt ab | GitHub schickt automatisch Mail. App zeigt letzten guten Stand |

**Grundprinzip:** Lieber nichts Neues zeigen als etwas Falsches. Der Feed
veraltet im schlimmsten Fall, er wird nie unzuverlässig.

### Betreiber‑Dashboard

Passwortgeschützte Seite: letzter Lauf, Themen verarbeitet/zurückgehalten,
Fehler, verbrauchtes KI‑Kontingent. Kein Code‑Zugriff nötig.

### Automatische Tests (laufen bei jeder Änderung)

- Bündelung: bekannte Artikel‑Beispiele → selbes Thema?
- ≥ 2‑Quellen‑Regel: Einzelmeldung → zurückgehalten?
- KI‑Ausgabe‑Form: immer gültiges JSON, jeder Fakt hat Quelle?
- Kategorie‑Werte: „Erdoğan in Berlin" → Deutschland ≥ 40 UND Türkei ≥ 40?
- Nahost‑Sonderregel: Opferzahlen ohne zweite Seite → zurückgehalten?
- Feed‑Anzeige: Karte rendert mit/ohne Bild, Chips korrekt?
- Rechtlich: kein Artikel‑Volltext in der Datenbank (Test prüft DB‑Felder)

### Abnahme Phase 1

- Läuft 7 Tage ohne manuellen Eingriff
- Feed jederzeit aktuell und korrekt kategorisiert
- Stichprobe 20 Themen von Hand geprüft → deckt sich mit Quellen, keine
  erfundenen Fakten
- Push kommt an (Android + iPhone nach Installation)
- Impressum/Datenschutz vorhanden

---

## 7. Offene Punkte für den Umsetzungsplan

- Exakte RSS‑Feed‑URLs sammeln und testen
- GDELT‑Stichwortlisten je Kategorie festlegen
- Gemini‑Prompt ausformulieren und gegen Beispiele testen
- Datenbank‑Schema (Themen, Artikel/Quellen, Kategorie‑Werte, Push‑Abos, Läufe)
- Cloudflare‑ und GitHub‑Konten einrichten (Nutzer legt an, Claude führt)
- Quellen‑Attribute (`typ`, `land`) je Quelle pflegen
- Medienschau: welche Kommentar‑Feeds, wie erkennen wir „Kommentar" vs „Meldung"
