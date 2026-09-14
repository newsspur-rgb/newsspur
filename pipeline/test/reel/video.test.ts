import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { audioDauerErmitteln, videoZusammensetzen } from '../../src/reel/video.js';

const execFileAsync = promisify(execFile);

let arbeitsverzeichnis: string;
let audioPfad: string;
let bildPfad: string;

beforeAll(async () => {
  arbeitsverzeichnis = await mkdtemp(path.join(tmpdir(), 'reel-video-test-'));
  audioPfad = path.join(arbeitsverzeichnis, 'audio.wav');
  bildPfad = path.join(arbeitsverzeichnis, 'bild.png');

  // Erzeugt Test-Fixtures direkt mit ffmpeg, damit keine Binaerdateien im Repo noetig sind.
  await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono', '-t', '1.5', audioPfad]);
  await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920', '-frames:v', '1', bildPfad]);
});

afterAll(async () => {
  await rm(arbeitsverzeichnis, { recursive: true, force: true });
});

describe('audioDauerErmitteln', () => {
  it('liest die Dauer einer WAV-Datei korrekt aus', async () => {
    const dauer = await audioDauerErmitteln(audioPfad);
    expect(dauer).toBeGreaterThan(1.4);
    expect(dauer).toBeLessThan(1.6);
  });

  it('wirft einen Fehler fuer eine nicht existierende Datei', async () => {
    await expect(audioDauerErmitteln('/pfad/gibt-es-nicht.wav')).rejects.toThrow();
  });
});

describe('videoZusammensetzen', () => {
  it('erzeugt eine MP4-Datei aus Hintergrundbild, Audio und Untertiteln', async () => {
    const ausgabePfad = path.join(arbeitsverzeichnis, 'out.mp4');
    const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,72,&HFFFFFF&,&HFFFFFF&,&H000000&,&H000000&,1,0,0,0,100,100,0,0,1,6,0,2,80,80,700,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:01.50,Caption,,0,0,0,,Test
`;
    await videoZusammensetzen(bildPfad, audioPfad, ass, ausgabePfad);

    const dauer = await audioDauerErmitteln(ausgabePfad);
    expect(dauer).toBeGreaterThan(1.4);
    expect(dauer).toBeLessThan(1.6);
  });
});
