# Design: Deutschland-Quellenregel lockern

**Datum:** 2026-09-19
**Status:** Freigegeben (Brainstorming), Umsetzungsplan folgt
**Bezug:** Teil 1 von 3 aus der Session vom 2026-09-18/19 (siehe [[bundestag-feature-design]], [[nahost-wer-sagt-was-design]] für die anderen beiden)

---

## 1. Ziel & Kontext

Aktuell braucht jedes Thema **mindestens 2 unabhängige Quellen**, bevor es
überhaupt zusammengefasst und veröffentlicht wird (`unabhaengigkeitPruefen`
in `pipeline/src/filter/independence.ts`). Für die Kategorie **Deutschland**
soll das gelockert werden: 1 Quelle reicht, wenn sie erkennbar deutsch ist –
aber die Meldung muss dann klar als Einzelquellen-Meldung gekennzeichnet
sein und in der Sicherheits-Einstufung gedeckelt werden.

**Nutzer-Vorgabe:** "1 Quelle reicht für Deutschland, aber die Quelle muss
draufstehen" + wichtige Meldungen weiterhin sofort per Push/Eilmeldung.

### Rahmenbedingung: Gemini-Kontingent ist knapp

Die Kategorie eines Themas (`kategorieWerte`) steht erst **nach** der
Gemini-Zusammenfassung fest (`ThemenZusammenfassung.kategorieWerte`,
`pipeline/src/types.ts:55`). Die bestehende Quellen-Prüfung läuft aber
**vor** Gemini – bewusst so gebaut, um teure Gemini-Aufrufe für Themen zu
sparen, die eh nicht genug Quellen haben. Eine naive Lösung ("bei nur 1
Quelle trotzdem immer zu Gemini schicken") würde die Gemini-Aufrufe pro
Lauf deutlich erhöhen und das Risiko der erst kürzlich gefixten
429-Rate-Limit-Probleme wieder steigern.

**Entscheidung:** Billiger Vorfilter statt Gemini-Aufruf für alle
Einzelquellen-Themen. Alle drei deutschen Feeds (`tagesschau`, `zeit`,
`spiegel`, siehe `pipeline/src/sources/feeds.ts`) sind mit `land: 'DE'`
getaggt. Nur Einzelquellen-Themen, deren einzige Quelle `land === 'DE'`
ist, gehen zu Gemini. Das ist nicht perfekt (ein DE-Verlag kann auch über
Türkei/Nahost berichten), aber hält die Mehrkosten klein – falsche
Positive fliegen nach der Gemini-Kategorisierung wieder raus (siehe unten).

### Bewusst NICHT Teil dieser Änderung (YAGNI)

- Keine Änderung an der Kategorien-Schwelle (`KATEGORIE_SCHWELLE = 40`)
- Keine Änderung an der "gleiche Agentur"-Regel (`schwach`-Fall, ≥2 Quellen)
- Keine harte Zähl-Tabelle o.ä. für Einzelquellen-Meldungen pro Tag
- Türkei/Nahost bleiben bei der 2-Quellen-Pflicht

---

## 2. Ablauf-Änderung (`pipeline/src/pipeline.ts`)

```
Thema hat < 2 unabhängige Quellen?
  │
  ├─ Nein (≥2, oder "schwach") → wie bisher
  │
  └─ Ja (nur 1 Quelle)
       │
       ├─ Quelle ist NICHT land='DE' → zurückhalten (wie bisher, unverändert)
       │
       └─ Quelle IST land='DE' → weiter zu Gemini (NEU)
            │
            ├─ Nach Zusammenfassung: Kategorie enthält "deutschland"?
            │    │
            │    ├─ Nein (z.B. DE-Verlag berichtete über Nahost)
            │    │    → doch zurückhalten, ursprünglicher Quellen-Grund (NEU)
            │    │
            │    └─ Ja → veröffentlichen, Sicherheit auf max. "mittel"
            │         deckeln (NEU), Einzelquellen-Flag für Web setzen
```

Der bestehende `schwach`-Zweig (≥2 Quellen, aber gleiche Agentur-Credit)
bleibt komplett unverändert und unabhängig von dieser Änderung.

## 3. Push-Effekt (kein Code nötig)

`pipeline/src/push/auswahl.ts` bleibt unverändert:
- Normale Push-Schwelle (`wichtigkeit >= 70`) greift weiterhin auch bei
  Einzelquellen-Meldungen → wichtige Einzelquellen-Meldungen lösen
  weiterhin sofort Push aus.
- "Nur Eilmeldungen"-Abos verlangen `sicherheit === 'hoch'`
  (`WICHTIGKEIT_SCHWELLE_EIL = 90`) – durch den Sicherheits-Deckel auf
  "mittel" automatisch ausgeschlossen. Kein zusätzlicher Code nötig.

## 4. Web: Einzelquellen-Badge

Auf Karte + Detailansicht ein sichtbares Label „Einzelquelle:
<Verlagsname>" zusätzlich zum bestehenden Quellenlink, wenn die Meldung
nur einen Artikel/eine Quelle hat. Ableitung direkt aus der Anzahl
unterschiedlicher `quelle.id` im `Thema` – kein neues Datenbankfeld nötig,
nur Anpassung in `web/src/aufbereiten.ts` + den Karten-/Detail-Templates.

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `pipeline/src/filter/independence.ts` | neue Funktion `nurDeutscheQuellen(thema): boolean` |
| `pipeline/src/pipeline.ts` | Ablauf wie in Abschnitt 2 |
| `pipeline/src/rules/kategorien.ts` oder `verify/verify.ts` | kleine Hilfsfunktion zum Sicherheits-Deckeln |
| `web/src/aufbereiten.ts` + Karten-/Detail-Templates | Einzelquellen-Badge |

## 6. Tests

- `independence.ts`: Test für `nurDeutscheQuellen()` (DE-Einzelquelle →
  true, TR/INT-Einzelquelle → false, 2+ Quellen → nicht relevant)
- `pipeline.ts` (Integrationstests mit Fake-Gemini-Client):
  - 1 DE-Quelle, Gemini kategorisiert als "deutschland" → veröffentlicht,
    Sicherheit gedeckelt auf max. "mittel"
  - 1 DE-Quelle, Gemini kategorisiert NICHT als "deutschland" (z.B.
    Nahost) → weiterhin zurückgehalten
  - 1 nicht-DE-Quelle → weiterhin sofort zurückgehalten, kein Gemini-Aufruf
- Web-Test: Badge erscheint nur bei genau 1 Quelle, nicht bei 2+

## 7. Fehlerbehandlung

Keine neuen Fehlerpfade. Folgt dem bestehenden Muster: schlägt der
Gemini-Aufruf fehl, wird das Thema übersprungen und beim nächsten
30-Minuten-Lauf erneut versucht (wie jetzt schon in `pipeline.ts`).
