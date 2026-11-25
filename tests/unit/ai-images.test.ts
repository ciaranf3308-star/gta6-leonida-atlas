import { describe, expect, it, vi } from 'vitest';
import { COUNTIES } from '../../src/data/counties';
import {
  AiImageError,
  COUNTY_ART_STORAGE_KEY,
  clearCountyArt,
  countyArtPrompt,
  generateCountyArt,
  readCountyArt,
  saveCountyArt,
  type CountyArtRecord,
} from '../../src/features/art/ai-images';

function memoryStorage(values: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(values));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

const county = COUNTIES.find((c) => c.id === 'mariana')!;
const record: CountyArtRecord = {
  countyId: 'mariana',
  dataUrl: 'data:image/jpeg;base64,/9j/abc',
  model: 'gpt-image-1',
  createdAt: '2026-11-24T00:00:00.000Z',
};

describe('county art prompts', () => {
  it('names the county and its mood, and bans text, logos and people', () => {
    const prompt = countyArtPrompt(county);
    expect(prompt).toContain('Mariana County');
    expect(prompt).toMatch(/no text, no logos, no people/i);
    expect(prompt).toMatch(/no identifiable real-world landmarks/i);
  });
});

describe('county art storage (on-device only)', () => {
  it('round-trips a record and clears it back to bundled art', () => {
    const storage = memoryStorage();
    expect(readCountyArt(storage)).toEqual({});
    saveCountyArt(record, storage);
    expect(readCountyArt(storage)).toEqual({ mariana: record });
    clearCountyArt('mariana', storage);
    expect(readCountyArt(storage)).toEqual({});
    expect(storage.getItem(COUNTY_ART_STORAGE_KEY)).toBeNull();
  });

  it('ignores corrupt or foreign values instead of crashing', () => {
    expect(readCountyArt(memoryStorage({ [COUNTY_ART_STORAGE_KEY]: 'not json' }))).toEqual({});
    expect(
      readCountyArt(
        memoryStorage({ [COUNTY_ART_STORAGE_KEY]: JSON.stringify({ mariana: { dataUrl: 'https://x/y.png' } }) }),
      ),
    ).toEqual({});
  });
});

describe('county art generation (key-powered, mocked fetch)', () => {
  const okFetch = (b64 = 'iVBORw0KGgo=') =>
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: b64 }] }),
    })) as unknown as typeof fetch;

  it('paints with gpt-image-1 and downscales to the stored record', async () => {
    const fetchImpl = okFetch();
    const result = await generateCountyArt({
      county,
      apiKey: 'sk-test',
      fetchImpl,
      downscale: async (url) => url.replace('data:image/png', 'data:image/jpeg'),
    });
    expect(result.countyId).toBe('mariana');
    expect(result.dataUrl).toBe('data:image/jpeg;base64,iVBORw0KGgo=');
    expect(result.model).toBe('gpt-image-1');
    const [url, init] = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
    expect(JSON.parse(init.body as string).model).toBe('gpt-image-1');
  });

  it('falls back to dall-e-3 when gpt-image-1 is unavailable for the key', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ b64_json: 'abc' }] }),
      }) as unknown as typeof fetch;
    const result = await generateCountyArt({
      county,
      apiKey: 'sk-test',
      fetchImpl,
      downscale: async (url) => url,
    });
    expect(result.dataUrl).toContain('abc');
    // PROVENANCE (v0.30.0): the fallback painter is dall-e-3, and the
    // stored record must say so — it used to hardcode 'gpt-image-1'
    // whatever actually painted the image.
    expect(result.model).toBe('dall-e-3');
    const secondCall = (
      fetchImpl as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(secondCall[1].body as string).model).toBe('dall-e-3');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refuses without a key and explains an invalid key', async () => {
    await expect(
      generateCountyArt({ county, apiKey: '', fetchImpl: okFetch() }),
    ).rejects.toBeInstanceOf(AiImageError);
    const badKey = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    await expect(generateCountyArt({ county, apiKey: 'sk-bad', fetchImpl: badKey })).rejects.toMatchObject({
      kind: 'auth',
    });
  });
});
