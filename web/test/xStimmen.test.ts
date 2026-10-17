import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index.js';

describe('Worker /api/x', () => {
  it('liefert die X-Themen der letzten Tage als JSON', async () => {
    const bind = vi.fn((..._p: unknown[]) => ({ all: vi.fn(async () => ({ results: [{ daten: JSON.stringify({ id: 'x1', titel: 'Rente' }) }] })) }));
    const db = { prepare: vi.fn(() => ({ bind })) } as any;
    const response = await worker.fetch(new Request('https://newsspur.de/api/x'), { DB: db, ASSETS: {} as any } as any);
    const daten = (await response.json()) as any;
    expect(daten.themen).toEqual([{ id: 'x1', titel: 'Rente' }]);
    expect(db.prepare.mock.calls[0][0]).toContain('FROM x_stimmen');
    expect(bind.mock.calls[0][1]).toBe(40);
  });
});
