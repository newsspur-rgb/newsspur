import { readFile } from 'node:fs/promises';

export interface ReelSpeicher {
  /** Laedt eine lokale MP4-Datei unter dem gegebenen Schluessel (z. B. "<themaId>.mp4") nach R2 hoch. */
  speichern(schluessel: string, dateiPfad: string): Promise<void>;
}

/** Laedt Reel-Videos per Cloudflare-R2-REST-API hoch (gleiches CLOUDFLARE_API_TOKEN wie D1, kein neues Secret). */
export function erstelleR2ReelSpeicher(
  accountId: string,
  bucketName: string,
  apiToken: string,
  fetchImpl: typeof fetch = fetch,
  leseDatei: (pfad: string) => Promise<Buffer> = readFile,
): ReelSpeicher {
  return {
    async speichern(schluessel, dateiPfad) {
      const inhalt = await leseDatei(dateiPfad);
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${schluessel}`;
      const antwort = await fetchImpl(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'video/mp4',
        },
        body: inhalt as unknown as BodyInit,
      });
      if (!antwort.ok) {
        throw new Error(`R2-Upload antwortete mit Status ${antwort.status}`);
      }
    },
  };
}
