import 'dotenv/config';
import type { Artikel } from './types.js';
import { feeds } from './sources/feeds.js';
import { feedAbrufen } from './sources/fetchRss.js';
import { gdeltAbrufen } from './sources/fetchGdelt.js';
import { gdeltAbfragen } from './sources/gdeltAbfragen.js';
import type { ThemenStore } from './store/store.js';
import { SpeicherThemenStore } from './store/memoryStore.js';
import { D1ThemenStore } from './store/d1Store.js';
import { erstelleGeminiClient } from './summarize/geminiClient.js';
import { erstelleGeminiEmbedFn } from './cluster/embed.js';
import { pipelineLauf, type SocialPoster, type PushBenachrichtiger } from './pipeline.js';
import { kartePngErzeugen } from './social/renderCard.js';
import { erstelleD1KartenSpeicher } from './social/kartenSpeicher.js';
import { erstelleInstagramClient } from './social/instagramClient.js';
import { captionErstellen } from './social/caption.js';
import { D1PushAbosStore } from './push/pushAbosStore.js';
import { erstelleWebPushClient } from './push/webPushClient.js';
import { abosFuerThema } from './push/auswahl.js';
import type { PushAbo } from './push/types.js';

function erstelleStore(): ThemenStore {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN } = process.env;
  if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_D1_DATABASE_ID && CLOUDFLARE_API_TOKEN) {
    console.log('Speicher: Cloudflare D1 (dauerhaft)');
    return new D1ThemenStore(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN);
  }
  console.log('Speicher: In-Memory (nur dieser Lauf, keine Cloudflare-Zugangsdaten gefunden)');
  return new SpeicherThemenStore();
}

function erstelleSocialPoster(): SocialPoster | undefined {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID } = process.env;
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN || !INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    console.log('Instagram-Posting: uebersprungen (keine Zugangsdaten gefunden)');
    return undefined;
  }
  console.log('Instagram-Posting: aktiv');
  const kartenSpeicher = erstelleD1KartenSpeicher(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN);
  const instagram = erstelleInstagramClient(INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID);
  return async (thema, zusammenfassung) => {
    const quellArtikel = thema.artikel.find((a) => a.bildUrl);
    const foto = quellArtikel?.bildUrl ? { url: quellArtikel.bildUrl, quelle: quellArtikel.quelle.name } : undefined;
    const png = await kartePngErzeugen(zusammenfassung, foto);
    await kartenSpeicher.speichern(thema.id, png);
    const kartenBildUrl = `https://newsspur.de/karte/${thema.id}.png`;
    await instagram.bildPosten(kartenBildUrl, captionErstellen(zusammenfassung));
  };
}

function erstellePushBenachrichtiger(): PushBenachrichtiger | undefined {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('Push-Benachrichtigungen: uebersprungen (keine Zugangsdaten gefunden)');
    return undefined;
  }
  console.log('Push-Benachrichtigungen: aktiv');
  const abosStore = new D1PushAbosStore(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN);
  const webPush = erstelleWebPushClient(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  let abosPromise: Promise<PushAbo[]> | undefined;

  return async (_thema, zusammenfassung) => {
    if (!abosPromise) abosPromise = abosStore.alle();
    const treffer = abosFuerThema(await abosPromise, zusammenfassung);
    if (treffer.length === 0) return;

    console.log(`Push-Benachrichtigungen: sende an ${treffer.length} Abo(s) fuer "${zusammenfassung.schlagzeile}"`);
    const payload = { titel: zusammenfassung.schlagzeile, text: zusammenfassung.zusammenfassung.slice(0, 120), url: 'https://newsspur.de' };
    for (const abo of treffer) {
      try {
        const { abgelaufen } = await webPush.senden(abo, payload);
        if (abgelaufen) await abosStore.entfernen(abo.endpoint);
      } catch (fehlerUrsache) {
        console.warn(`Push an ${abo.endpoint} fehlgeschlagen:`, fehlerUrsache);
      }
    }
  };
}

async function sammle(
  aufgaben: { name: string; lauf: () => Promise<Artikel[]> }[],
): Promise<Artikel[]> {
  const ergebnisse = await Promise.allSettled(aufgaben.map((a) => a.lauf()));
  const artikel: Artikel[] = [];
  ergebnisse.forEach((e, i) => {
    if (e.status === 'fulfilled') {
      artikel.push(...e.value);
      console.log(`  ok   ${aufgaben[i].name}: ${e.value.length} Artikel`);
    } else {
      console.warn(`  FEHL ${aufgaben[i].name}: ${e.reason}`);
    }
  });
  return artikel;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY fehlt. Bitte pipeline/.env aus .env.example anlegen.');
    process.exit(1);
  }

  console.log(`RSS-Feeds (${feeds.length}):`);
  const rss = await sammle(feeds.map((f) => ({ name: f.quelle.id, lauf: () => feedAbrufen(f) })));

  console.log(`GDELT-Abfragen (${gdeltAbfragen.length}):`);
  const gdelt = await sammle(gdeltAbfragen.map((a) => ({ name: a.kategorie, lauf: () => gdeltAbrufen(a) })));

  const alle = [...rss, ...gdelt];
  console.log(`\n${alle.length} Artikel gesammelt. Starte Pipeline ...\n`);

  const store = erstelleStore();
  const vorLauf = new Date().toISOString();
  const ergebnis = await pipelineLauf(alle, {
    store,
    geminiClient: erstelleGeminiClient(apiKey),
    embedFn: erstelleGeminiEmbedFn(apiKey),
    socialPoster: erstelleSocialPoster(),
    pushBenachrichtiger: erstellePushBenachrichtiger(),
  });

  console.log('Ergebnis:', ergebnis, '\n');
  for (const t of await store.neuereAls(vorLauf)) {
    const titel = t.zusammenfassung?.schlagzeile ?? t.thema.artikel[0]?.titel ?? '(ohne Titel)';
    console.log(`[${t.status}] ${titel}`);
    if (t.zusammenfassung) {
      const k = t.zusammenfassung.kategorieWerte;
      console.log(`   Kategorien D:${k.deutschland} T:${k.tuerkei} N:${k.nahost} | Wichtigkeit ${t.zusammenfassung.wichtigkeit} | Sicherheit ${t.zusammenfassung.sicherheit}`);
    }
    if (t.grund) console.log(`   Grund: ${t.grund}`);
  }
}

main().catch((fehler) => {
  console.error('Pipeline-Lauf fehlgeschlagen:', fehler);
  process.exit(1);
});
