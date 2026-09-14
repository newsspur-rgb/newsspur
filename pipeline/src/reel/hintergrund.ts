import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { relevanteKategorien, type Kategorie } from '../rules/kategorien.js';
import type { KategorieWerte } from '../types.js';

const KATEGORIE_LABEL: Record<Kategorie, string> = {
  deutschland: 'DEUTSCHLAND',
  tuerkei: 'TÜRKIYE',
  nahost: 'NAHOST-KONFLIKT',
};

const ROT = '#E11D0F';
const SCHWARZ = '#0B0B0B';
const WEISS = '#F3F1EC';

const HIER_DIR = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(HIER_DIR, '../../assets/fonts');

let fontCache: Array<{ name: string; data: Buffer; weight: 700; style: 'normal' }> | null = null;

async function ladeFonts() {
  if (fontCache) return fontCache;
  const oswaldBold = await readFile(path.join(FONT_DIR, 'Oswald-Bold.ttf'));
  fontCache = [{ name: 'Oswald', data: oswaldBold, weight: 700, style: 'normal' }];
  return fontCache;
}

/** Erzeugt einen 1080x1920-Boulevard-Hintergrund (Logo + Kategorie-Chip) fuer Reels als PNG-Buffer. */
export async function reelHintergrundErzeugen(kategorieWerte: KategorieWerte): Promise<Buffer> {
  const kategorien = relevanteKategorien(kategorieWerte);
  const fonts = await ladeFonts();

  const element = {
    type: 'div',
    props: {
      style: {
        width: 1080,
        height: 1920,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: SCHWARZ,
      },
      children: [
        { type: 'div', props: { style: { width: '100%', height: 20, backgroundColor: ROT } } },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', padding: '48px 56px', gap: 16 },
            children: [
              {
                type: 'span',
                props: {
                  style: { fontFamily: 'Oswald', fontWeight: 700, fontSize: 56, color: WEISS, letterSpacing: -1 },
                  children: 'NEWSSPUR',
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'row', gap: 8 },
                  children: kategorien.map((k) => ({
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        border: `2px solid ${WEISS}`,
                        color: WEISS,
                        fontFamily: 'Oswald',
                        fontWeight: 700,
                        fontSize: 20,
                        padding: '6px 14px',
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                      },
                      children: KATEGORIE_LABEL[k],
                    },
                  })),
                },
              },
            ],
          },
        },
      ],
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(element as any, { width: 1080, height: 1920, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  return resvg.render().asPng();
}
