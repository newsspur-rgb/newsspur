const WOERTER_PRO_ZEILE = 3;
// ASS-Farben sind BGR, nicht RGB: #E11D0F -> 0F1DE1, #F3F1EC -> ECF1F3 (gleiche Palette wie renderCard.ts).
const ROT_BGR = '0F1DE1';
const WEISS_BGR = 'ECF1F3';
const SCHWARZ_BGR = '0B0B0B';

function zeitFormat(sekunden: number): string {
  const h = Math.floor(sekunden / 3600);
  const m = Math.floor((sekunden % 3600) / 60);
  const s = Math.floor(sekunden % 60);
  const cs = Math.round((sekunden - Math.floor(sekunden)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

interface WortZeile {
  start: number;
  ende: number;
  text: string;
}

/**
 * Verteilt die Woerter gleichmaessig ueber die bekannte Audiodauer (Piper liefert keine
 * Wort-Zeitstempel) und gruppiert sie in kurze Zeilen mit rot hervorgehobenem aktuellem Wort -
 * Technik angelehnt an shorts-machine/mkshorts.py, hier ohne Whisper-Abhaengigkeit.
 */
function woerterVerteilen(sprechtext: string, dauerSekunden: number): WortZeile[] {
  const woerter = sprechtext.split(/\s+/).filter(Boolean);
  if (woerter.length === 0) return [];
  const proWort = dauerSekunden / woerter.length;
  const zeilen: WortZeile[] = [];

  for (let i = 0; i < woerter.length; i += WOERTER_PRO_ZEILE) {
    const gruppe = woerter.slice(i, i + WOERTER_PRO_ZEILE);
    for (let j = 0; j < gruppe.length; j++) {
      const wortIndex = i + j;
      const start = wortIndex * proWort;
      const ende = start + proWort;
      const text = gruppe.map((w, k) => (k === j ? `{\\c&H${ROT_BGR}&}${w}{\\c&H${WEISS_BGR}&}` : w)).join(' ');
      zeilen.push({ start, ende, text });
    }
  }
  return zeilen;
}

/** Baut eine .ass-Untertitel-Datei mit wortweise rot hervorgehobenen Zeilen im Boulevard-Look. */
export function assErstellen(sprechtext: string, dauerSekunden: number): string {
  const zeilen = woerterVerteilen(sprechtext, dauerSekunden);
  const events = zeilen
    .map((z) => `Dialogue: 0,${zeitFormat(z.start)},${zeitFormat(z.ende)},Caption,,0,0,0,,${z.text}`)
    .join('\n');

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Oswald,72,&H${WEISS_BGR}&,&H${WEISS_BGR}&,&H${SCHWARZ_BGR}&,&H${SCHWARZ_BGR}&,1,0,0,0,100,100,0,0,1,6,0,2,80,80,700,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
}
