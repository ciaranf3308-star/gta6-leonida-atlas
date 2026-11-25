import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const finalizer = resolve("scripts/finalize-build.mjs");
const base = "/atlas/";
const origin = "https://atlas.example";
const temporaryDirectories: string[] = [];

function finalize(directory: string) {
  execFileSync(process.execPath, [finalizer], {
    cwd: directory,
    env: {
      ...process.env,
      ATLAS_OUT_DIR: "dist",
      ATLAS_BASE_PATH: base,
      VITE_ANALYTICS_ID: "",
      VITE_ANALYTICS_ORIGIN: "https://measurement.example",
      VITE_ANALYTICS_PARENT_ORIGIN: origin,
    },
    stdio: "pipe",
    // finalize spins up a Vite SSR server; under a loaded box its
    // output can exceed execFileSync's 1 MB default buffer and fail
    // as spawnSync ENOBUFS (the same known flake as the
    // atlas-security finalize tests) — a big buffer removes that
    // false failure without hiding a real one.
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
}

interface FetchEvent {
  request: Request;
  respondWith(response: Promise<Response | undefined>): void;
}

/** The atlas-security workerHarness, plus a network-failure hook:
 * fetch throws instead of answering when `fetchThrowsFor` matches. */
function workerHarness(
  source: string,
  options: {
    fetchResponse?: (url: string) => { status: number; body: string };
    fetchThrowsFor?: (url: string) => boolean;
  } = {},
) {
  const handlers = new Map<string, (event: FetchEvent) => void>();
  const fetches: string[] = [];
  const cachedUrls: string[] = [];
  const context = {
    URL,
    self: {
      location: { origin },
      addEventListener: (type: string, listener: (event: FetchEvent) => void) =>
        handlers.set(type, listener),
    },
    caches: {
      open: async () => ({
        match: async () => undefined,
        keys: async () => [],
        put: async (request: Request | string) => {
          cachedUrls.push(
            typeof request === "string" ? request : request.url,
          );
        },
      }),
    },
    fetch: async (request: Request | string) => {
      const url = typeof request === "string" ? request : request.url;
      fetches.push(url);
      if (options.fetchThrowsFor?.(url)) throw new Error("Network error");
      const override = options.fetchResponse?.(url);
      const response = new Response(override?.body ?? "Public network content", {
        status: override?.status ?? 200,
        headers: { "cache-control": "public, max-age=3600" },
      });
      Object.defineProperty(response, "type", { value: "basic" });
      return response;
    },
  };
  runInNewContext(source, context);
  return {
    fetches,
    cachedUrls,
    dispatch(path: string) {
      let response: Promise<Response | undefined> | undefined;
      const request = new Request(new URL(path, origin));
      handlers.get("fetch")!({
        request,
        respondWith: (value) => {
          response = value;
        },
      });
      return response;
    },
  };
}

async function tileFixture() {
  const directory = await mkdtemp(join(tmpdir(), "atlas-sw-tiles-"));
  temporaryDirectories.push(directory);
  const files: Record<string, string> = {
    "index.html":
      '<!doctype html><html><head><title>Fixture</title><meta name="description" content="fixture"></head><body><div id="root"></div></body></html>',
    "favicon.svg": "<svg/>",
    "manifest.webmanifest": "{}",
    "icons/icon-192.png": "",
    "icons/icon-512.png": "",
    "assets/app-test.js": 'console.log("public app")',
    "assets/app-test.css": "body{color:black}",
    "assets/gta6-leonida-atlas/basemap.svg": "<svg><title>Original</title></svg>",
    "assets/street-leonida/maps/gtadb-landmarks-d406fea.json":
      '{"landmarks":[]}',
    // The fallback: ocean.jpg IS the graded pure-sea tile.
    "assets/gta6-leonida-atlas/tiles/ocean.jpg": "ocean bytes",
    // A land tile at z0 (present in the pyramid, not pure sea).
    "assets/gta6-leonida-atlas/tiles/graded/0/0,1,1.jpg": "land bytes",
    // A pure-sea fill tile at z0 — byte-identical to ocean.jpg, so
    // the pyramid marks it as ocean.
    "assets/gta6-leonida-atlas/tiles/graded/0/0,0,0.jpg": "ocean bytes",
    // A land tile at max zoom.
    "assets/gta6-leonida-atlas/tiles/graded/6/6,100,100.jpg": "land bytes",
  };
  for (const [path, contents] of Object.entries(files)) {
    const destination = join(directory, "dist", path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("generated service worker — land tiles are never ocean (v0.30.0)", () => {
  let worker: string;
  beforeAll(async () => {
    const directory = await tileFixture();
    finalize(directory);
    worker = await readFile(join(directory, "dist/sw.js"), "utf8");
  }, 120_000);

  const fetchResponse = (url: string) =>
    url.endsWith("/tiles/ocean.jpg")
      ? { status: 200, body: "ocean bytes" }
      : { status: 404, body: "Not Found" };

  it("embeds a tile manifest built from the pyramid on disk", () => {
    const match = worker.match(/const TILE_MANIFEST=(\{.*?\});/);
    expect(match, "worker embeds TILE_MANIFEST").toBeTruthy();
    const manifest = JSON.parse(match![1] as string) as Record<
      string,
      { p: string; o: string }
    >;
    // z0 grid is 3×4 = 12 bits = 2 bytes = 4 hex chars.
    expect(manifest["0"]?.p).toHaveLength(4);
    expect(manifest["0"]?.o).toHaveLength(4);
    // z6 grid is 192×256 = 49,152 bits = 6,144 bytes.
    expect(manifest["6"]?.p).toHaveLength(6144 * 2);
  });

  it("a failed LAND tile is handed back as the failure, never ocean, never cached", async () => {
    const harness = workerHarness(worker, { fetchResponse });
    const tile = "/atlas/assets/gta6-leonida-atlas/tiles/graded/0/0,1,1.jpg";
    const response = await harness.dispatch(tile);
    expect(response?.status).toBe(404);
    expect(await response?.text()).toBe("Not Found");
    expect(harness.fetches).toEqual([`${origin}${tile}`]);
    expect(harness.cachedUrls).not.toContain(`${origin}${tile}`);
  });

  it("a failed land tile at max zoom is never ocean (the v0.24 P0)", async () => {
    const harness = workerHarness(worker, { fetchResponse });
    const tile = "/atlas/assets/gta6-leonida-atlas/tiles/graded/6/6,100,100.jpg";
    const response = await harness.dispatch(tile);
    expect(response?.status).toBe(404);
    expect(await response?.text()).toBe("Not Found");
    expect(harness.fetches).toEqual([`${origin}${tile}`]);
    expect(harness.cachedUrls).not.toContain(`${origin}${tile}`);
  });

  it("a tile beyond the pyramid's grid is genuine ocean — served, cached under its URL", async () => {
    const harness = workerHarness(worker, { fetchResponse });
    // One tile past the edge (Leaflet asks for it), and one inside
    // the grid rectangle the pyramid never drew.
    for (const tile of [
      "/atlas/assets/gta6-leonida-atlas/tiles/graded/0/0,0,-1.jpg",
      "/atlas/assets/gta6-leonida-atlas/tiles/graded/0/0,3,2.jpg",
    ]) {
      const response = await harness.dispatch(tile);
      expect(response?.status).toBe(200);
      expect(await response?.text()).toBe("ocean bytes");
      expect(harness.cachedUrls).toContain(`${origin}${tile}`);
    }
    expect(harness.fetches).toContain(
      `${origin}/atlas/assets/gta6-leonida-atlas/tiles/ocean.jpg`,
    );
  });

  it("a failed pure-sea fill tile is ocean — byte-identical to the fallback", async () => {
    const harness = workerHarness(worker, { fetchResponse });
    const tile = "/atlas/assets/gta6-leonida-atlas/tiles/graded/0/0,0,0.jpg";
    const response = await harness.dispatch(tile);
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("ocean bytes");
    expect(harness.cachedUrls).toContain(`${origin}${tile}`);
  });

  it("a tile beyond the pyramid (z7) is never ocean", async () => {
    const harness = workerHarness(worker, { fetchResponse });
    const tile = "/atlas/assets/gta6-leonida-atlas/tiles/graded/7/7,0,0.jpg";
    const response = await harness.dispatch(tile);
    expect(response?.status).toBe(404);
    expect(await response?.text()).toBe("Not Found");
    expect(harness.cachedUrls).not.toContain(`${origin}${tile}`);
  });

  it("a network failure for a land tile is a failure, not ocean", async () => {
    const tile = "/atlas/assets/gta6-leonida-atlas/tiles/graded/0/0,1,1.jpg";
    const harness = workerHarness(worker, {
      fetchResponse,
      fetchThrowsFor: (url) => url.endsWith("/graded/0/0,1,1.jpg"),
    });
    await expect(harness.dispatch(tile)).rejects.toThrow();
    expect(harness.fetches).not.toContain(
      `${origin}/atlas/assets/gta6-leonida-atlas/tiles/ocean.jpg`,
    );
    expect(harness.cachedUrls).not.toContain(`${origin}${tile}`);
  });

  it("a successful land tile still caches normally (cache behaviour intact)", async () => {
    const harness = workerHarness(worker, {
      fetchResponse: (url) =>
        url.endsWith("/graded/0/0,1,1.jpg")
          ? { status: 200, body: "land bytes" }
          : { status: 404, body: "Not Found" },
    });
    const tile = "/atlas/assets/gta6-leonida-atlas/tiles/graded/0/0,1,1.jpg";
    const response = await harness.dispatch(tile);
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("land bytes");
    expect(harness.cachedUrls).toContain(`${origin}${tile}`);
  });

  it("the cache name moves when a tile is added to the pyramid", async () => {
    const directory = await tileFixture();
    finalize(directory);
    const before = await readFile(join(directory, "dist/sw.js"), "utf8");
    const beforeCache = before.match(/const CACHE="([^"]+)"/)?.[1];
    expect(beforeCache).toBeTruthy();
    await mkdir(join(directory, "dist/assets/gta6-leonida-atlas/tiles/graded/0"), {
      recursive: true,
    });
    await writeFile(
      join(directory, "dist/assets/gta6-leonida-atlas/tiles/graded/0/0,2,2.jpg"),
      "new land bytes",
    );
    finalize(directory);
    const after = await readFile(join(directory, "dist/sw.js"), "utf8");
    const afterCache = after.match(/const CACHE="([^"]+)"/)?.[1];
    expect(afterCache).toBeTruthy();
    expect(afterCache).not.toBe(beforeCache);
  }, 120_000);
});
