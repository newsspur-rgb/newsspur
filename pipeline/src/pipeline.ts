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
