import { reelErzeugen } from './reel/reelErstellen.js';
import type { ThemenZusammenfassung } from './types.js';

// Erzeugt ein Beispiel-Reel aus einer festen Test-Zusammenfassung, zum manuellen Anschauen.
// Aufruf: PIPER_MODEL_PFAD=/pfad/zu/de_DE-thorsten-high.onnx npm run pipeline:reel-test

const beispiel: ThemenZusammenfassung = {
  themaId: 'demo',
  schlagzeile: 'Erdogan trifft Bundeskanzler in Berlin',
  zusammenfassung:
    'Der tuerkische Praesident traf den Bundeskanzler zu einem Gespraech ueber die Zukunft der deutsch-tuerkischen Beziehungen. Beide Seiten betonten den Willen zu engerer Zusammenarbeit.',
  kategorieWerte: { deutschland: 90, tuerkei: 85, nahost: 0 },
  wichtigkeit: 80,
  wichtigkeitBegruendung: 'Staatsbesuch',
  fakten: [],
  strittigePunkte: [],
  sicherheit: 'hoch',
};

async function main(): Promise<void> {
  const modelPfad = process.env.PIPER_MODEL_PFAD;
  if (!modelPfad) {
    console.error('PIPER_MODEL_PFAD fehlt (Pfad zur .onnx-Stimme).');
    process.exit(1);
  }
  console.log('Erzeuge Beispiel-Reel ...');
  const pfad = await reelErzeugen(beispiel, modelPfad, process.cwd());
  console.log('Fertig:', pfad);
}

main().catch((fehler) => {
  console.error('Reel-Erzeugung fehlgeschlagen:', fehler);
  process.exit(1);
});
