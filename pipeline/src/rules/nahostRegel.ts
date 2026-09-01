import type { Thema, ThemenZusammenfassung } from '../types.js';

// Sensible Begriffe: Opfer/Schuld. Bewusst konservativ (lieber einmal zu oft
// zurueckhalten). Liste waechst mit Erfahrung.
const SENSIBLE_MUSTER = /(tote|toten|getoetet|opfer|opferzahl|verletzt|verantwortlich|schuld|massaker|kriegsverbrechen)/i;

// Quellen-Kennungen, die eine "Seite" abdecken. Waechst mit der Feed-Liste.
const ISRAELISCHE_QUELLEN = new Set(['times-of-israel', 'haaretz', 'jpost']);
const ARABISCH_KATARISCHE_QUELLEN = new Set(['al-jazeera', 'middle-east-eye', 'the-national']);

export interface NahostPruefung {
  betroffen: boolean;
  zurueckhalten: boolean;
  grund?: string;
}

export function nahostSonderregelPruefen(zusammenfassung: ThemenZusammenfassung, thema: Thema): NahostPruefung {
  if (zusammenfassung.kategorieWerte.nahost < 40) {
    return { betroffen: false, zurueckhalten: false };
  }

  const sensibel =
    SENSIBLE_MUSTER.test(zusammenfassung.zusammenfassung) ||
    zusammenfassung.fakten.some((f) => SENSIBLE_MUSTER.test(f.text));

  if (!sensibel) {
    return { betroffen: true, zurueckhalten: false };
  }

  if (zusammenfassung.sicherheit === 'niedrig') {
    return { betroffen: true, zurueckhalten: true, grund: 'Sensible Angabe bei niedriger Sicherheit.' };
  }

  const ids = new Set(thema.artikel.map((a) => a.quelle.id));
  const hatIsrael = [...ids].some((id) => ISRAELISCHE_QUELLEN.has(id));
  const hatArabisch = [...ids].some((id) => ARABISCH_KATARISCHE_QUELLEN.has(id));

  if (!hatIsrael || !hatArabisch) {
    return {
      betroffen: true,
      zurueckhalten: true,
      grund: 'Sensible Angabe (Opferzahlen/Schuldzuweisung), aber nicht beide Seiten unter den Quellen vertreten.',
    };
  }

  return { betroffen: true, zurueckhalten: false };
}
