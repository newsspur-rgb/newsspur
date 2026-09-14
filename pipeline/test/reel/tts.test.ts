import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { erstelleTtsClient } from '../../src/reel/tts.js';

function fakeProzess(exitCode: number, stderrText = '') {
  const proc: any = new EventEmitter();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.stderr = new EventEmitter();
  setTimeout(() => {
    if (stderrText) proc.stderr.emit('data', Buffer.from(stderrText));
    proc.emit('close', exitCode);
  }, 0);
  return proc;
}

describe('erstelleTtsClient', () => {
  it('ruft python3 -m piper mit dem Modellpfad auf und schreibt den Text auf stdin', async () => {
    const spawnImpl = vi.fn(() => fakeProzess(0));
    const client = erstelleTtsClient('/pfad/modell.onnx', spawnImpl as any);

    await client.erzeugen('Hallo Welt', '/tmp/out.wav');

    expect(spawnImpl).toHaveBeenCalledWith('python3', ['-m', 'piper', '--model', '/pfad/modell.onnx', '--output_file', '/tmp/out.wav']);
    const proc = spawnImpl.mock.results[0].value;
    expect(proc.stdin.write).toHaveBeenCalledWith('Hallo Welt');
  });

  it('wirft einen Fehler mit stderr-Inhalt, wenn piper mit Exit-Code != 0 endet', async () => {
    const spawnImpl = vi.fn(() => fakeProzess(1, 'Modell nicht gefunden'));
    const client = erstelleTtsClient('/pfad/modell.onnx', spawnImpl as any);

    await expect(client.erzeugen('Text', '/tmp/out.wav')).rejects.toThrow('Modell nicht gefunden');
  });
});
