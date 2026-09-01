import type { Feed } from '../types.js';

// Neue Quelle = eine Zeile. URLs werden bei der Ausfuehrung (Task 11) gegen
// die echten Feeds geprueft und ggf. korrigiert.
export const feeds: Feed[] = [
  { quelle: { id: 'tagesschau', name: 'Tagesschau', typ: 'oeffentlich-rechtlich', land: 'DE', sprache: 'de' }, url: 'https://www.tagesschau.de/index~rss2.xml' },
  { quelle: { id: 'zeit', name: 'Zeit Online', typ: 'zeitung', land: 'DE', sprache: 'de' }, url: 'https://newsfeed.zeit.de/index' },
  { quelle: { id: 'spiegel', name: 'Der Spiegel', typ: 'zeitung', land: 'DE', sprache: 'de' }, url: 'https://www.spiegel.de/schlagzeilen/tops/index.rss' },

  { quelle: { id: 'dw-tuerkisch', name: 'DW Tuerkce', typ: 'unabhaengig', land: 'TR', sprache: 'tr' }, url: 'https://rss.dw.com/rdf/rss-tur-all' },
  { quelle: { id: 'trt-haber', name: 'TRT Haber', typ: 'staatsnah', land: 'TR', sprache: 'tr' }, url: 'https://www.trthaber.com/xml_mobile.php?tur=xml_genel' },
  { quelle: { id: 'bianet', name: 'Bianet', typ: 'unabhaengig', land: 'TR', sprache: 'tr' }, url: 'https://bianet.org/rss.php' },

  { quelle: { id: 'bbc-nahost', name: 'BBC Middle East', typ: 'oeffentlich-rechtlich', land: 'INT', sprache: 'en' }, url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
  { quelle: { id: 'al-jazeera', name: 'Al Jazeera', typ: 'staatsnah', land: 'INT', sprache: 'en' }, url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { quelle: { id: 'times-of-israel', name: 'Times of Israel', typ: 'zeitung', land: 'INT', sprache: 'en' }, url: 'https://www.timesofisrael.com/feed/' },
];
