import webPush from 'web-push';
import type { PushAbo } from './types.js';

export interface PushPayload {
  titel: string;
  text: string;
  url: string;
}

export interface WebPushClient {
  senden(abo: PushAbo, payload: PushPayload): Promise<{ abgelaufen: boolean }>;
}

type WebPushLib = Pick<typeof webPush, 'setVapidDetails' | 'sendNotification'>;

/** Duenner Wrapper um das web-push-Paket. abgelaufen=true bedeutet: Subscription ist ungueltig (404/410), Aufrufer sollte das Abo loeschen. */
export function erstelleWebPushClient(
  vapidPublicKey: string,
  vapidPrivateKey: string,
  webPushImpl: WebPushLib = webPush,
  kontaktEmail = 'mailto:kontakt@newsspur.de',
): WebPushClient {
  webPushImpl.setVapidDetails(kontaktEmail, vapidPublicKey, vapidPrivateKey);
  return {
    async senden(abo, payload) {
      try {
        await webPushImpl.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          JSON.stringify(payload),
        );
        return { abgelaufen: false };
      } catch (fehler) {
        const status = (fehler as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return { abgelaufen: true };
        throw fehler;
      }
    },
  };
}
