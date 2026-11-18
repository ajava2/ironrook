import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pbRecordId } from '../../src/core/pbId';
import { openFitDb } from '../../src/data/db';
import { Repository } from '../../src/data/repository';
import { syncWithPocketBase } from '../../src/services/pocketbase';

afterEach(() => vi.unstubAllGlobals());

describe('syncWithPocketBase', () => {
  it('sube lo local (PATCH, y POST si no existe) y aplica lo remoto más reciente', async () => {
    const repo = new Repository(await openFitDb('sync-test'));
    await repo.saveWeight('2026-10-27', 75.1);
    const remoteWeight = { date: '2026-10-28', kg: 75.6, updatedAt: Date.now() + 10_000 };

    const calls: { method: string; url: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        calls.push({ method, url });
        if (method === 'PATCH') return new Response('{}', { status: 404 });
        if (method === 'POST') return new Response('{}', { status: 200 });
        return new Response(
          JSON.stringify({
            items: [{ id: 'x', store: 'weights', key: remoteWeight.date, payload: remoteWeight, updatedAt: remoteWeight.updatedAt }],
            totalPages: 1,
          }),
          { status: 200 },
        );
      }),
    );

    const result = await syncWithPocketBase('http://pb.local:8090/', repo);
    expect(result).toEqual({ pushed: 1, pulled: 1 });
    const id = pbRecordId('weights', '2026-10-27');
    expect(calls[0]).toEqual({ method: 'PATCH', url: `http://pb.local:8090/api/collections/fit_records/records/${id}` });
    expect(calls[1]!.method).toBe('POST');
    expect((await repo.allWeights()).map((w) => w.kg).sort()).toEqual([75.1, 75.6]);
    expect(await repo.getLastSync()).toBeGreaterThan(0);

    calls.length = 0;
    const second = await syncWithPocketBase('http://pb.local:8090', repo);
    expect(second.pushed).toBe(0);
  });
});
