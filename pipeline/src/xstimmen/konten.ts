import type { Kategorie } from '../rules/kategorien.js';

/** Ländergruppen der X-Stimmen. Die ersten drei entsprechen den newsspur-Kategorien. */
export type XGruppe = Kategorie | 'usa' | 'westeuropa' | 'eu' | 'russland' | 'china' | 'japan';

export const X_GRUPPEN: XGruppe[] = ['deutschland', 'tuerkei', 'nahost', 'usa', 'westeuropa', 'eu', 'russland', 'china', 'japan'];

export const X_GRUPPE_NAME: Record<XGruppe, string> = {
  deutschland: 'Deutschland',
  tuerkei: 'Türkei',
  nahost: 'Naher Osten (Israel/Palästina, Iran, Syrien, Irak)',
  usa: 'USA',
  westeuropa: 'Frankreich, Großbritannien, Spanien, Belgien',
  eu: 'Europäische Union',
  russland: 'Russland',
  china: 'China',
  japan: 'Japan',
};

/**
 * Nebenländer (nicht im Fokus wie DE/TR/Nahost/USA/EU) - hier nur Themen von echtem
 * Gewicht aufnehmen (Kriege/Konflikte, harte Vorgehen/Repression, große Krisen),
 * keine Alltagspolitik oder Propaganda-Nebensächlichkeiten.
 */
export const X_GRUPPE_FOKUS: Partial<Record<XGruppe, string>> = {
  russland: 'Nur Kriege/Konflikte (v. a. Ukraine), harte Vorgehen gegen Opposition/Kriminalität und vergleichbar wichtige Themen - keine Alltagspolitik.',
  china: 'Nur Kriege/Konflikte (z. B. Taiwan, Südchinesisches Meer), harte Vorgehen gegen Kriminalität/Opposition und vergleichbar wichtige Themen - keine Alltagspolitik.',
  japan: 'Nur Kriege/Konflikte, Sicherheitspolitik und vergleichbar wichtige Themen - keine Alltagspolitik.',
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
  // Max. ~16 Konten (Länge der kombinierten from:-Suchanfrage) - deshalb bewusst nur
  // Regierungen/Staatschefs je Land statt zusätzlicher Medien-Konten.
  nahost: {
    IsraeliPM: 'Israels Ministerpräsident',
    IsraelMFA: 'Israels Außenministerium',
    IDF: 'Israelische Armee',
    UNRWA: 'UNRWA',
    ochaopt: 'UN OCHA (Palästina)',
    khamenei_ir: 'Irans Ali Chamenei',
    drpezeshkian: 'Irans Präsident Peseschkian',
    araghchi: 'Irans Außenminister Araghtschi',
    AH_AlSharaa: 'Syriens Präsident Ahmed al-Scharaa',
    syrianmofaex: 'Syrisches Außenministerium',
    IraqiPMO: 'Büro des irakischen Ministerpräsidenten',
    Iraqimofa: 'Irakisches Außenministerium',
    AJEnglish: 'Al Jazeera English',
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
  russland: {
    mfa_russia: 'Russisches Außenministerium',
    KremlinRussia_E: 'Kreml',
    tass_agency: 'TASS (Staatsagentur)',
  },
  china: {
    MFA_China: 'Chinesisches Außenministerium',
    XHNews: 'Xinhua (Staatsagentur)',
  },
  japan: {
    JPN_PMO: 'Büro des japanischen Premierministers',
    MofaJapan_en: 'Japanisches Außenministerium',
    NHKWORLD_News: 'NHK World',
  },
};

export function kontoName(gruppe: XGruppe, handle: string): string {
  const konten = X_KONTEN[gruppe];
  const treffer = Object.keys(konten).find((h) => h.toLowerCase() === handle.toLowerCase());
  return treffer ? konten[treffer] : '@' + handle;
}
