export interface InstagramClient {
  bildPosten(bildUrl: string, caption: string): Promise<{ postId: string }>;
  reelPosten(videoUrl: string, caption: string): Promise<{ postId: string }>;
}

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
// Meta empfiehlt, den Verarbeitungsstatus eines Reel-Containers hoechstens 5x im 60s-Abstand abzufragen.
const STATUS_POLL_VERSUCHE_MAX = 5;
const STATUS_POLL_WARTEZEIT_MS = 60_000;

/**
 * Baut eine Fehlermeldung mit der echten Graph-API-Meldung (z. B. "Session has expired ..."),
 * nicht nur dem Statuscode - sonst sieht man bei einem Fehlschlag nur "Status 400" und muss
 * den Aufruf manuell nachstellen, um den eigentlichen Grund zu erfahren.
 */
async function graphFehler(antwort: Response, kontext: string): Promise<Error> {
  let detail = '';
  try {
    const daten = (await antwort.json()) as { error?: { message?: string } };
    if (daten?.error?.message) detail = `: ${daten.error.message}`;
  } catch {
    // Antwort war kein (gueltiges) JSON - Statuscode allein reicht dann als Meldung.
  }
  return new Error(`${kontext} antwortete mit Status ${antwort.status}${detail}`);
}

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
        throw await graphFehler(containerAntwort, 'Instagram-Media-Erstellung');
      }
      const { id: creationId } = (await containerAntwort.json()) as { id: string };

      const publishAntwort = await fetchImpl(`${GRAPH_URL}/${businessAccountId}/media_publish?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: creationId }),
      });
      if (!publishAntwort.ok) {
        throw await graphFehler(publishAntwort, 'Instagram-Veroeffentlichung');
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
        throw await graphFehler(containerAntwort, 'Instagram-Reel-Erstellung');
      }
      const { id: creationId } = (await containerAntwort.json()) as { id: string };

      let fertig = false;
      for (let versuch = 0; versuch < STATUS_POLL_VERSUCHE_MAX; versuch++) {
        await warteImpl(STATUS_POLL_WARTEZEIT_MS);
        const statusAntwort = await fetchImpl(`${GRAPH_URL}/${creationId}?fields=status_code&access_token=${accessToken}`);
        if (!statusAntwort.ok) {
          throw await graphFehler(statusAntwort, 'Instagram-Reel-Status');
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
        throw await graphFehler(publishAntwort, 'Instagram-Reel-Veroeffentlichung');
      }
      const { id: postId } = (await publishAntwort.json()) as { id: string };
      return { postId };
    },
  };
}
