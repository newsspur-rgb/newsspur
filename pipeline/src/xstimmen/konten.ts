import type { Kategorie } from '../rules/kategorien.js';

/**
 * Geprüfte X-Konten je Kategorie: Regierungen, Parteien, Behörden, große Redaktionen.
 * Eine offene X-Suche liefert fast nur Spam/Spendenaufrufe - deshalb nur diese Konten.
 * Handle -> Anzeigename (so erscheint es auf newsspur.de).
 */
export const X_KONTEN: Record<Kategorie, Record<string, string>> = {
  deutschland: {
    bundeskanzler: 'Bundeskanzler',
    RegSprecher: 'Regierungssprecher',
    AuswaertigesAmt: 'Auswärtiges Amt',
    BMF_Bund: 'Finanzministerium',
    BMI_Bund: 'Innenministerium',
    bmvg_bundeswehr: 'Verteidigungsministerium',
    bundestag: 'Deutscher Bundestag',
    CDU: 'CDU',
    CSU: 'CSU',
    spdde: 'SPD',
    AfD: 'AfD',
    Die_Gruenen: 'Grüne',
    dieLinke: 'Die Linke',
    tagesschau: 'tagesschau',
    ZDFheute: 'ZDFheute',
  },
  tuerkei: {
    RTErdogan: 'Recep Tayyip Erdoğan',
    trpresidency: 'Türkisches Präsidialamt',
    HakanFidan: 'Außenminister Hakan Fidan',
    TC_Disisleri: 'Türkisches Außenministerium',
    Akparti: 'AKP',
    herkesicinCHP: 'CHP',
    eczozgurozel: 'Özgür Özel (CHP)',
    ekrem_imamoglu: 'Ekrem İmamoğlu',
    anadoluajansi: 'Anadolu Ajansı',
    dwturkce: 'DW Türkçe',
    bbcturkce: 'BBC Türkçe',
  },
  nahost: {
    IsraeliPM: 'Israels Ministerpräsident',
    IsraelMFA: 'Israels Außenministerium',
    IDF: 'Israelische Armee',
    araghchi: 'Irans Außenminister',
    IRIMFA_SPOX: 'Sprecher Iran-Außenministerium',
    UNRWA: 'UNRWA',
    ochaopt: 'UN OCHA (Palästina)',
    ICRC: 'Rotes Kreuz (IKRK)',
    CENTCOM: 'US CENTCOM',
    AJEnglish: 'Al Jazeera English',
    BBCBreaking: 'BBC Breaking News',
    Reuters: 'Reuters',
  },
};

export function kontoName(kategorie: Kategorie, handle: string): string {
  const konten = X_KONTEN[kategorie];
  const treffer = Object.keys(konten).find((h) => h.toLowerCase() === handle.toLowerCase());
  return treffer ? konten[treffer] : '@' + handle;
}
