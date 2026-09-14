import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const HIER_DIR = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(HIER_DIR, '../../assets/fonts');

/** Ermittelt die Dauer einer Audiodatei in Sekunden ueber ffmpegs eigene Ausgabe (kein ffprobe noetig). */
export async function audioDauerErmitteln(pfad: string): Promise<number> {
  try {
    await execFileAsync('ffmpeg', ['-i', pfad]);
  } catch (fehler) {
    const stderr = (fehler as { stderr?: string }).stderr ?? '';
    const treffer = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (treffer) {
      const [, h, m, s] = treffer;
      return Number(h) * 3600 + Number(m) * 60 + Number(s);
    }
  }
  throw new Error(`Audiodauer konnte nicht ermittelt werden: ${pfad}`);
}

/** Setzt Hintergrundbild, Audio und eingebrannte Untertitel per ffmpeg zu einem 9:16-MP4 zusammen. */
export async function videoZusammensetzen(
  hintergrundPngPfad: string,
  audioWavPfad: string,
  assInhalt: string,
  ausgabeMp4Pfad: string,
): Promise<void> {
  const assPfad = ausgabeMp4Pfad.replace(/\.mp4$/, '.ass');
  await writeFile(assPfad, assInhalt, 'utf-8');

  await execFileAsync('ffmpeg', [
    '-y',
    '-loop', '1',
    '-i', hintergrundPngPfad,
    '-i', audioWavPfad,
    '-vf', `subtitles=${assPfad}:fontsdir=${FONT_DIR}`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    ausgabeMp4Pfad,
  ]);
}
