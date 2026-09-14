export interface InstagramClient {
  bildPosten(bildUrl: string, caption: string): Promise<{ postId: string }>;
  reelPosten(videoUrl: string, caption: string): Promise<{ postId: string }>;
}

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
// Meta empfiehlt, den Verarbeitungsstatus eines Reel-Containers hoechstens 5x im 60s-Abstand abzufragen.
const STATUS_POLL_VERSUCHE_MAX = 5;
const STATUS_POLL_WARTEZEIT_MS = 60_000;

export function erstelleInstagramClient(
  accessToken: string,
  businessAccountId: string,
  fetchImpl: typeof fetch = fetch,
  warteImpl: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): InstagramClient {
  return {
    async bildPosten(bildUrl, caption) {
      const containerAntwort = await fetchImpl(`${GRAPH_URL}/${businessAccountId}/media?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: bildUrl, caption }),
      });
      if (!containerAntwort.ok) {
        throw new Error(`Instagram-Media-Erstellung antwortete mit Status ${containerAntwort.status}`);
      }
      const { id: creationId } = (await containerAntwort.json()) as { id: string };

      const publishAntwort = await fetchImpl(`${GRAPH_URL}/${businessAccountId}/media_publish?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: creationId }),
      });
      if (!publishAntwort.ok) {
        throw new Error(`Instagram-Veroeffentlichung antwortete mit Status ${publishAntwort.status}`);
      }
      const { id: postId } = (await publishAntwort.json()) as { id: string };
      return { postId };
    },

    async reelPosten(videoUrl, caption) {
      const containerAntwort = await fetchImpl(`${GRAPH_URL}/${businessAccountId}/media?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_type: 'REELS', video_url: videoUrl, caption }),
      });
      if (!containerAntwort.ok) {
        throw new Error(`Instagram-Reel-Erstellung antwortete mit Status ${containerAntwort.status}`);
      }
      const { id: creationId } = (await containerAntwort.json()) as { id: string };

      let fertig = false;
      for (let versuch = 0; versuch < STATUS_POLL_VERSUCHE_MAX; versuch++) {
        await warteImpl(STATUS_POLL_WARTEZEIT_MS);
        const statusAntwort = await fetchImpl(`${GRAPH_URL}/${creationId}?fields=status_code&access_token=${accessToken}`);
        if (!statusAntwort.ok) {
          throw new Error(`Instagram-Reel-Status antwortete mit Status ${statusAntwort.status}`);
        }
        const { status_code: statusCode } = (await statusAntwort.json()) as { status_code: string };
        if (statusCode === 'FINISHED') {
          fertig = true;
          break;
        }
        if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
          throw new Error(`Instagram-Reel-Verarbeitung fehlgeschlagen: ${statusCode}`);
        }
      }
      if (!fertig) {
        throw new Error('Instagram-Reel-Verarbeitung hat das Zeitlimit ueberschritten');
      }

      const publishAntwort = await fetchImpl(
        `${GRAPH_URL}/${businessAccountId}/media_publish?creation_id=${creationId}&access_token=${accessToken}`,
        { method: 'POST' },
      );
      if (!publishAntwort.ok) {
        throw new Error(`Instagram-Reel-Veroeffentlichung antwortete mit Status ${publishAntwort.status}`);
      }
      const { id: postId } = (await publishAntwort.json()) as { id: string };
      return { postId };
    },
  };
}
