export interface InstagramClient {
  bildPosten(bildUrl: string, caption: string): Promise<{ postId: string }>;
}

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

export function erstelleInstagramClient(
  accessToken: string,
  businessAccountId: string,
  fetchImpl: typeof fetch = fetch,
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
  };
}
