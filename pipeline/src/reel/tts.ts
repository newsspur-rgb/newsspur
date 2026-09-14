import { spawn, type ChildProcess } from 'node:child_process';

type SpawnFn = (command: string, args: string[]) => ChildProcess;

export interface TtsClient {
  /** Erzeugt aus Text eine WAV-Datei am angegebenen Pfad. */
  erzeugen(text: string, ausgabePfad: string): Promise<void>;
}

/** Duenner Wrapper um `python3 -m piper` (piper-tts-Paket) - lokale, kostenlose Text-zu-Sprache. */
export function erstelleTtsClient(modelPfad: string, spawnImpl: SpawnFn = spawn): TtsClient {
  return {
    erzeugen(text, ausgabePfad) {
      return new Promise((resolve, reject) => {
        const prozess = spawnImpl('python3', ['-m', 'piper', '--model', modelPfad, '--output_file', ausgabePfad]);
        let stderr = '';
        prozess.stderr?.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        prozess.on('error', reject);
        prozess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`piper beendete sich mit Code ${code}: ${stderr}`));
        });
        prozess.stdin?.write(text);
        prozess.stdin?.end();
      });
    },
  };
}
