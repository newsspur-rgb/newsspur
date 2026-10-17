import type { Kategorie } from '../rules/kategorien.js';

/** Ländergruppen der X-Stimmen. Die ersten drei entsprechen den newsspur-Kategorien. */
export type XGruppe = Kategorie | 'iran' | 'usa' | 'westeuropa' | 'eu';

export const X_GRUPPEN: XGruppe[] = ['deutschland', 'tuerkei', 'nahost', 'iran', 'usa', 'westeuropa', 'eu'];

export const X_GRUPPE_NAME: Record<XGruppe, string> = {
  deutschland: 'Deutschland',
  tuerkei: 'Türkei',
  nahost: 'Nahost-Konflikt (Israel/Palästina)',
  iran: 'Iran',
  usa: 'USA',
  westeuropa: 'Frankreich, Großbritannien, Spanien, Belgien',
  eu: 'Europäische Union',
};

/**
 * Geprüfte X-Konten je Gruppe: Regierungen, Parteien, Behörden, große Redaktionen.
 * Eine offene X-Suche liefert fast nur Spam/Spendenaufrufe - deshalb nur diese Konten.
 * Handle -> Anzeigename (so erscheint es auf newsspur.de). Max. ~16 Konten je Gruppe (Länge der X-Suchanfrage).
 */
export const X_KONTEN: Record<XGruppe, Record<string, string>> = {
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
    UNRWA: 'UNRWA',
    ochaopt: 'UN OCHA (Palästina)',
    ICRC: 'Rotes Kreuz (IKRK)',
    CENTCOM: 'US CENTCOM',
    AJEnglish: 'Al Jazeera English',
    BBCBreaking: 'BBC Breaking News',
    Reuters: 'Reuters',
  },
  iran: {
    khamenei_ir: 'Ali Chamenei',
    drpezeshkian: 'Präsident Peseschkian',
    araghchi: 'Außenminister Araghtschi',
    IRIMFA_SPOX: 'Sprecher Iran-Außenministerium',
    IranIntl_En: 'Iran International',
    PressTV: 'Press TV (Staatssender)',
    BBCPersian: 'BBC Persian',
  },
  usa: {
    POTUS: 'US-Präsident',
    WhiteHouse: 'Weißes Haus',
    PressSec: 'Sprecherin Weißes Haus',
    StateDept: 'US-Außenministerium',
    SecRubio: 'Außenminister Rubio',
    DeptofDefense: 'US-Verteidigungsministerium',
    SpeakerJohnson: 'Speaker Repräsentantenhaus',
    GOP: 'Republikaner',
    TheDemocrats: 'Demokraten',
    AP: 'Associated Press',
    cnnbrk: 'CNN Breaking News',
  },
  westeuropa: {
    EmmanuelMacron: 'Emmanuel Macron',
    Elysee: 'Élysée-Palast',
    francediplo: 'Französisches Außenministerium',
    Keir_Starmer: 'Keir Starmer',
    '10DowningStreet': 'Britische Regierung',
    FCDOGovUK: 'Britisches Außenministerium',
    sanchezcastejon: 'Pedro Sánchez',
    desdelamoncloa: 'Spanische Regierung',
    MAECgob: 'Spanisches Außenministerium',
    Bart_DeWever: 'Bart De Wever (Belgien)',
    BelgiumMFA: 'Belgisches Außenministerium',
    AFP: 'AFP',
    BBCWorld: 'BBC World',
  },
  eu: {
    vonderleyen: 'Ursula von der Leyen',
    EU_Commission: 'EU-Kommission',
    eucopresident: 'EU-Ratspräsident',
    EUCouncil: 'Rat der EU',
    Europarl_EN: 'Europäisches Parlament',
    EP_President: 'Präsidentin EU-Parlament',
    kajakallas: 'EU-Außenbeauftragte Kallas',
    eu_eeas: 'Europäischer Auswärtiger Dienst',
  },
};

export function kontoName(gruppe: XGruppe, handle: string): string {
  const konten = X_KONTEN[gruppe];
  const treffer = Object.keys(konten).find((h) => h.toLowerCase() === handle.toLowerCase());
  return treffer ? konten[treffer] : '@' + handle;
}
