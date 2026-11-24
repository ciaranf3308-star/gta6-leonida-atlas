import { useEffect, useState } from 'react';
import type { County } from '../../data/counties';
import { getAskApiKey } from '../ask/openai';

/**
 * County art from the user's own OpenAI key (After Hours, v0.15.0).
 *
 * The same on-device key Ask and the indexer use (`leonida-ask-api-key`,
 * localStorage only, never bundled, never logged, never committed).
 * One image per county, generated when the user chooses it in Settings,
 * stored on this device as a downscaled JPEG data URL, labelled
 * "AI image" wherever it shows. The art is regional art — a dusk
 * landscape in the county's mood — never a fake photograph of a real
 * place, and it never invents place data: the image illustrates the
 * county, the county's places still come from GTADB.
 *
 * Cost: OpenAI charges per image on the user's key (gpt-image-1).
 * A failed generation never touches the bundled art.
 */

export const COUNTY_ART_STORAGE_KEY = 'leonida-county-art-v1';
export const COUNTY_ART_CHANGED_EVENT = 'leonida-county-art-changed';

export interface CountyArtRecord {
  countyId: string;
  /** Downscaled JPEG data URL, 880x587. */
  dataUrl: string;
  model: string;
  createdAt: string;
}

export type CountyArtStore = Record<string, CountyArtRecord>;

/** Per-county art direction — mood only, no real places, no landmarks. */
const COUNTY_ART_MOOD: Record<string, string> = {
  lummox: 'a northern mountain county at dusk, high peaks, pine forest, cold blue dusk light, a winding road far below',
  kelly: 'a quiet west-coast port town at dusk, a small harbour with fishing boats, warm lights in windows, low clouds',
  leonard: 'a rural southern town at golden hour, farmland and a sleepy main street, long shadows, warm haze',
  'vice-dale': 'a coastal city skyline at sunset seen across the bay, palm trees in silhouette, warm dusk sky, no neon signs',
  mariana: 'a tropical island chain at sunset, palm trees, turquoise shallows, a narrow sandy shore, a distant low bridge',
};

const ART_SUFFIX =
  'Cinematic wide photograph, premium travel-atlas art direction, restrained colour, no text, no logos, no people, no identifiable real-world landmarks.';

export function countyArtPrompt(county: County): string {
  const mood = COUNTY_ART_MOOD[county.id] ?? `the ${county.area} region of Leonida at dusk`;
  return `${county.name}, Leonida — ${mood}. ${ART_SUFFIX}`;
}

export function readCountyArt(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): CountyArtStore {
  try {
    const raw = storage?.getItem(COUNTY_ART_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: CountyArtStore = {};
    for (const [id, record] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        record &&
        typeof record === 'object' &&
        typeof (record as CountyArtRecord).dataUrl === 'string' &&
        (record as CountyArtRecord).dataUrl.startsWith('data:image/jpeg')
      ) {
        out[id] = record as CountyArtRecord;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCountyArt(
  record: CountyArtRecord,
  storage: Pick<Storage, 'setItem' | 'getItem'> | null = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): void {
  const store = readCountyArt(storage);
  store[record.countyId] = record;
  try {
    storage?.setItem(COUNTY_ART_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full or unavailable — the bundled art stays.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(COUNTY_ART_CHANGED_EVENT));
  }
}

export function clearCountyArt(
  countyId: string,
  storage: Pick<Storage, 'setItem' | 'getItem' | 'removeItem'> | null = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): void {
  const store = readCountyArt(storage);
  delete store[countyId];
  try {
    if (Object.keys(store).length === 0) storage?.removeItem(COUNTY_ART_STORAGE_KEY);
    else storage?.setItem(COUNTY_ART_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Nothing to do — the bundled art stays either way.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(COUNTY_ART_CHANGED_EVENT));
  }
}

export class AiImageError extends Error {
  kind: 'auth' | 'rate-limited' | 'unavailable' | 'network' | 'bad-response';
  constructor(kind: AiImageError['kind'], message: string) {
    super(message);
    this.kind = kind;
  }
}

interface ImagesResponse {
  data?: { b64_json?: string; url?: string }[];
  error?: { message?: string; code?: string };
}

async function callImagesApi(
  apiKey: string,
  model: string,
  prompt: string,
  size: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, prompt, size, n: 1 }),
      signal,
    });
  } catch {
    throw new AiImageError(
      'network',
      'Could not reach OpenAI. Check the connection and try again — the bundled art is untouched.',
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new AiImageError(
      'auth',
      'OpenAI did not accept that key. Check it in Settings → Ask Nylah — the bundled art is untouched.',
    );
  }
  if (res.status === 429) {
    throw new AiImageError(
      'rate-limited',
      'OpenAI is rate-limiting image requests right now. Wait a little and try again — the bundled art is untouched.',
    );
  }
  if (!res.ok) {
    throw new AiImageError(
      'unavailable',
      `OpenAI returned ${res.status} for the image request. The bundled art is untouched.`,
    );
  }
  let json: ImagesResponse;
  try {
    json = (await res.json()) as ImagesResponse;
  } catch {
    throw new AiImageError(
      'bad-response',
      'OpenAI answered, but not with an image. The bundled art is untouched.',
    );
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    throw new AiImageError(
      'bad-response',
      'OpenAI answered, but not with an image. The bundled art is untouched.',
    );
  }
  // Both image models return PNG bytes; the downscaler re-encodes to JPEG.
  return `data:image/png;base64,${b64}`;
}

/** Downscale a JPEG data URL to 880x587 (the county card size) in-browser. */
export async function downscaleArtDataUrl(dataUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image load failed'));
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 880;
  canvas.height = 587;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  return canvas.toDataURL('image/jpeg', 0.72);
}

/**
 * Paint one county's art with the user's key. Tries gpt-image-1 first,
 * falls back to dall-e-3 when the key cannot use it. The key is read
 * from the same on-device store as Ask — callers never pass it around.
 */
export async function generateCountyArt(input: {
  county: County;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  downscale?: (dataUrl: string) => Promise<string>;
  signal?: AbortSignal;
}): Promise<CountyArtRecord> {
  const apiKey = input.apiKey ?? getAskApiKey();
  if (!apiKey) {
    throw new AiImageError(
      'auth',
      'Add your OpenAI key in Settings → Ask Nylah first — art is painted with your key, on this device.',
    );
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const downscale = input.downscale ?? downscaleArtDataUrl;
  const prompt = countyArtPrompt(input.county);
  let dataUrl: string;
  try {
    dataUrl = await callImagesApi(
      apiKey,
      'gpt-image-1',
      prompt,
      '1536x1024',
      fetchImpl,
      input.signal,
    );
  } catch (error) {
    // gpt-image-1 is not on every key: dall-e-3 paints the same prompt.
    if (error instanceof AiImageError && error.kind === 'unavailable') {
      dataUrl = await callImagesApi(
        apiKey,
        'dall-e-3',
        prompt,
        '1792x1024',
        fetchImpl,
        input.signal,
      );
    } else {
      throw error;
    }
  }
  const downsized = await downscale(dataUrl);
  return {
    countyId: input.county.id,
    dataUrl: downsized,
    model: 'gpt-image-1',
    createdAt: new Date().toISOString(),
  };
}

/** Live county-art store: reads on mount, refreshes when art changes. */
export function useCountyArt(): CountyArtStore {
  const [store, setStore] = useState<CountyArtStore>(() => readCountyArt());
  useEffect(() => {
    const refresh = () => setStore(readCountyArt());
    window.addEventListener(COUNTY_ART_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(COUNTY_ART_CHANGED_EVENT, refresh);
  }, []);
  return store;
}
