import { describe, it, expect, vi } from 'vitest';
import { erstelleWebPushClient } from '../../src/push/webPushClient.js';
import type { PushAbo } from '../../src/push/types.js';

function abo(): PushAbo {
  return {
    endpoint: 'https://push.example/e1',
    p256dh: 'p',
    auth: 'a',
    deutschland: true,
    tuerkei: false,
    nahost: false,
    nurEilmeldungen: false,
  };
}

function fakeWebPush(sendNotification: ReturnType<typeof vi.fn>) {
  return { setVapidDetails: vi.fn(), sendNotification } as any;
}

describe('erstelleWebPushClient', () => {
  it('sendet die Payload als JSON an die Subscription', async () => {
    const sendNotification = vi.fn(async () => {});
    const impl = fakeWebPush(sendNotification);
    const client = erstelleWebPushClient('pub', 'priv', impl);

    const ergebnis = await client.senden(abo(), { titel: 'T', text: 'Text', url: 'https://newsspur.de' });

    expect(ergebnis.abgelaufen).toBe(false);
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: abo().endpoint, keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify({ titel: 'T', text: 'Text', url: 'https://newsspur.de' }),
    );
  });

  it('meldet abgelaufen=true bei Status 410 statt einen Fehler zu werfen', async () => {
    const sendNotification = vi.fn(async () => {
      throw Object.assign(new Error('Gone'), { statusCode: 410 });
    });
    const client = erstelleWebPushClient('pub', 'priv', fakeWebPush(sendNotification));

    const ergebnis = await client.senden(abo(), { titel: 'T', text: 'Text', url: 'https://newsspur.de' });
    expect(ergebnis.abgelaufen).toBe(true);
  });

  it('wirft andere Fehler weiter', async () => {
    const sendNotification = vi.fn(async () => {
      throw Object.assign(new Error('Server-Fehler'), { statusCode: 500 });
    });
    const client = erstelleWebPushClient('pub', 'priv', fakeWebPush(sendNotification));

    await expect(client.senden(abo(), { titel: 'T', text: 'Text', url: 'https://newsspur.de' })).rejects.toThrow('Server-Fehler');
  });
});
