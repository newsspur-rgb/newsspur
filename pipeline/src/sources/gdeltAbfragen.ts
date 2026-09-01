export interface GdeltAbfrage {
  kategorie: 'deutschland' | 'tuerkei' | 'nahost';
  suchbegriff: string;
}

export const gdeltAbfragen: GdeltAbfrage[] = [
  { kategorie: 'deutschland', suchbegriff: '(Deutschland OR Bundestag OR Bundesregierung) sourcelang:ger' },
  { kategorie: 'tuerkei', suchbegriff: '(Turkey OR Tuerkiye OR Erdogan) sourcelang:tur' },
  { kategorie: 'nahost', suchbegriff: '(Gaza OR Israel OR "West Bank" OR Hezbollah OR Iran) sourcelang:eng' },
];
