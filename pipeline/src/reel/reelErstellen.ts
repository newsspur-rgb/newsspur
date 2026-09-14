import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { erstelleTtsClient } from './tts.js';
import { sprechtextErstellen } from './skript.js';
import { reelHintergrundErzeugen } from './hintergrund.js';
import { assErstellen } from './untertitel.js';
import { audioDauerErmitteln, videoZusammensetzen } from './video.js';
import type { ThemenZusammenfassung } from '../types.js';

/** Erzeugt aus einer Zusammenfassung ein 9:16-MP4-Reel (Sprache + eingebrannte Untertitel) und gibt den Dateipfad zurueck. */
export async function reelErzeugen(
  zusammenfassung: ThemenZusammenfassung,
  modelPfad: string,
  arbeitsverzeichnis: string = tmpdir(),
): Promise<string> {
  const sprechtext = sprechtextErstellen(zusammenfassung);
  const audioPfad = path.join(arbeitsverzeichnis, `${zusammenfassung.themaId}.wav`);
  const hintergrundPfad = path.join(arbeitsverzeichnis, `${zusammenfassung.themaId}.png`);
  const videoPfad = path.join(arbeitsverzeichnis, `${zusammenfassung.themaId}.mp4`);

  const tts = erstelleTtsClient(modelPfad);
  await tts.erzeugen(sprechtext, audioPfad);

  const hintergrundPng = await reelHintergrundErzeugen(zusammenfassung.kategorieWerte);
  await writeFile(hintergrundPfad, hintergrundPng);

  const dauer = await audioDauerErmitteln(audioPfad);
  const ass = assErstellen(sprechtext, dauer);

  await videoZusammensetzen(hintergrundPfad, audioPfad, ass, videoPfad);
  return videoPfad;
}
