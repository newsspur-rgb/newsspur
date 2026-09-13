import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { ThemenZusammenfassung } from '../types.js';
import { relevanteKategorien, type Kategorie } from '../rules/kategorien.js';

const KATEGORIE_LABEL: Record<Kategorie, string> = {
  deutschland: 'DEUTSCHLAND',
  tuerkei: 'TÜRKIYE',
  nahost: 'NAHOST-KONFLIKT',
};

const ROT = '#E11D0F';
const SCHWARZ = '#0B0B0B';
const WEISS = '#F3F1EC';
const GRAU = '#86847C';

const HIER_DIR = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(HIER_DIR, '../../assets/fonts');

let fontCache: Awaited<ReturnType<typeof ladeFonts>> | null = null;

async function ladeFonts() {
  const [oswaldBold, hankenRegular, hankenSemiBold] = await Promise.all([
    readFile(path.join(FONT_DIR, 'Oswald-Bold.ttf')),
    readFile(path.join(FONT_DIR, 'HankenGrotesk-Regular.ttf')),
    readFile(path.join(FONT_DIR, 'HankenGrotesk-SemiBold.ttf')),
  ]);
  return [
    { name: 'Oswald', data: oswaldBold, weight: 700 as const, style: 'normal' as const },
    { name: 'Hanken Grotesk', data: hankenRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Hanken Grotesk', data: hankenSemiBold, weight: 600 as const, style: 'normal' as const },
  ];
}

function headlineGroesse(schlagzeile: string): number {
  if (schlagzeile.length <= 40) return 76;
  if (schlagzeile.length <= 70) return 62;
  if (schlagzeile.length <= 100) return 52;
  return 44;
}

function karteElement(zusammenfassung: ThemenZusammenfassung) {
  const kategorien = relevanteKategorien(zusammenfassung.kategorieWerte);

  return {
    type: 'div',
    props: {
      style: {
        width: 1080,
        height: 1080,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: SCHWARZ,
        fontFamily: 'Hanken Grotesk',
      },
      children: [
        { type: 'div', props: { style: { width: '100%', height: 14, backgroundColor: ROT } } },
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '56px 64px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column' },
                        children: [
                          {
                            type: 'span',
                            props: {
                              style: { fontFamily: 'Oswald', fontWeight: 700, fontSize: 44, color: WEISS, letterSpacing: -1 },
                              children: 'NEWSSPUR',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                marginTop: 8,
                                backgroundColor: ROT,
                                color: WEISS,
                                fontFamily: 'Hanken Grotesk',
                                fontWeight: 600,
                                fontSize: 15,
                                padding: '4px 12px',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                              },
                              children: 'Kein Blatt vor dem Mund',
                            },
                          },
                        ],
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
                              fontFamily: 'Hanken Grotesk',
                              fontWeight: 600,
                              fontSize: 16,
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
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flex: 1, alignItems: 'center' },
                  children: {
                    type: 'span',
                    props: {
                      style: {
                        fontFamily: 'Oswald',
                        fontWeight: 700,
                        color: WEISS,
                        fontSize: headlineGroesse(zusammenfassung.schlagzeile),
                        lineHeight: 1.08,
                        letterSpacing: -1,
                      },
                      children: zusammenfassung.schlagzeile,
                    },
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '2px solid #333',
                    paddingTop: 20,
                  },
                  children: [
                    {
                      type: 'span',
                      props: {
                        style: {
                          fontFamily: 'Hanken Grotesk',
                          fontWeight: 600,
                          fontSize: 16,
                          color: GRAU,
                          textTransform: 'uppercase',
                          letterSpacing: 2,
                        },
                        children: 'Automatisch erstellt',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/** Erzeugt eine 1080x1080-PNG-Textkarte fuer eine veroeffentlichte Meldung (Boulevard-Look). */
export async function kartePngErzeugen(zusammenfassung: ThemenZusammenfassung): Promise<Buffer> {
  if (!fontCache) fontCache = await ladeFonts();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(karteElement(zusammenfassung) as any, {
    width: 1080,
    height: 1080,
    fonts: fontCache,
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  return resvg.render().asPng();
}
