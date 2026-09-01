import { XMLParser } from 'fast-xml-parser';
import type { Artikel, Feed } from '../types.js';
import { kurzeHashId } from '../util/hash.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function alsArray<T>(wert: T | T[] | undefined): T[] {
  if (wert === undefined || wert === null) return [];
  return Array.isArray(wert) ? wert : [wert];
}

function bildAusItem(item: any): string | undefined {
  return item?.enclosure?.['@_url'] ?? item?.['media:content']?.['@_url'] ?? item?.['media:thumbnail']?.['@_url'] ?? undefined;
}

function datumAusItem(item: any): string {
  const roh = item?.pubDate ?? item?.['dc:date'] ?? item?.published ?? item?.updated;
  const datum = roh ? new Date(roh) : new Date();
  return isNaN(datum.getTime()) ? new Date().toISOString() : datum.toISOString();
}

function textFeld(wert: any): string | undefined {
  if (typeof wert === 'string') return wert;
  if (wert && typeof wert['#text'] === 'string') return wert['#text'];
  return undefined;
}

function linkAusItem(item: any): string | undefined {
  if (typeof item?.link === 'string') return item.link;
  if (item?.link?.['@_href']) return item.link['@_href'];
  if (Array.isArray(item?.link)) {
    const alternate = item.link.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel']);
    return alternate?.['@_href'];
  }
  return textFeld(item?.link) ?? textFeld(item?.guid);
}

export async function feedAbrufen(feed: Feed, fetchImpl: typeof fetch = fetch): Promise<Artikel[]> {
  const antwort = await fetchImpl(feed.url);
  if (!antwort.ok) {
    throw new Error(`Feed ${feed.quelle.id} antwortete mit Status ${antwort.status}`);
  }
  const daten = parser.parse(await antwort.text());
  const rohItems = alsArray(
    daten?.rss?.channel?.item ?? daten?.['rdf:RDF']?.item ?? daten?.feed?.entry,
  );

  const artikel: Artikel[] = [];
  for (const item of rohItems) {
    const titel = textFeld(item?.title)?.trim();
    const url = linkAusItem(item)?.trim();
    if (!titel || !url) continue;
    const teaser = String(item?.description ?? item?.summary ?? item?.['content:encoded'] ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    artikel.push({
      id: kurzeHashId(url),
      quelle: feed.quelle,
      titel,
      teaser,
      url,
      bildUrl: bildAusItem(item),
      veroeffentlichtAm: datumAusItem(item),
    });
  }
  return artikel;
}
