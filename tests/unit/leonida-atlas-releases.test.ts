import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProjectPage from "../../src/features/project/ProjectPage";
import {
  LEONIDA_ATLAS_RELEASES,
  latestLeonidaAtlasRelease,
} from "../../src/features/street-leonida/releases";

/** renderToStaticMarkup escapes text the way React does — an
 * apostrophe in a title becomes &#x27; in the markup, so a raw
 * toContain on the title would fail even though the page is right. */
const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");

describe("Leonida Atlas release history", () => {
  it("retains every release since v0.5.0 in newest-first order across the changelog and documentation", async () => {
    expect(LEONIDA_ATLAS_RELEASES.map((release) => release.version)).toEqual([
      "v0.22.0",
      "v0.21.0",
      "v0.20.2",
      "v0.20.0",
      "v0.19.0",
      "v0.18.0",
      "v0.17.0",
      "v0.16.0",
      "v0.15.0",
      "v0.14.0",
      "v0.13.0",
      "v0.12.0",
      "v0.11.0",
      "v0.10.0",
      "v0.9.0",
      "v0.8.2",
      "v0.8.1",
      "v0.8.0",
      "v0.7.0",
      "v0.6.2",
      "v0.6.1",
      "v0.6.0",
      "v0.5.0",
    ]);
    expect(latestLeonidaAtlasRelease).toMatchObject({
      version: "v0.22.0",
      date: "2026-11-25",
      status: "public",
    });
    const markup = renderToStaticMarkup(
      createElement(ProjectPage, {
        page: "changelog",
        onClose: () => undefined,
      }),
    );
    const { version } = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    );
    const documentation = await readFile(
      new URL("../../RELEASES.md", import.meta.url),
      "utf8",
    );
    expect(documentation.match(/^## (v[\d.]+)/m)?.[1]).toBe("v" + version);
    expect(latestLeonidaAtlasRelease.version).toBe("v" + version);
    for (const output of [markup, documentation]) {
      for (const { version } of LEONIDA_ATLAS_RELEASES)
        expect(output).toContain(version);
      expect(output).toContain("Released");
      expect(output).not.toMatch(/\bv0\.[1-4]\.\d+\b/);
      expect(output).not.toContain("local candidate; not pushed");
    }
    expect(markup).toContain(escapeHtml(latestLeonidaAtlasRelease.title));
  });

  it("shows the same release history on About with direct version links and a single current badge", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectPage, { page: "about", onClose: () => undefined }),
    );
    expect(markup).toContain("Release history");
    for (const release of LEONIDA_ATLAS_RELEASES) {
      expect(markup).toContain(
        `https://github.com/navanem/gta6-leonida-atlas/releases/tag/${release.version}`,
      );
      expect(markup).toContain(escapeHtml(release.title));
      expect(markup).toContain(escapeHtml(release.summary));
    }
    expect(markup.match(/>Current</g)).toHaveLength(1);
    expect(markup).toContain("Full changelog");
  });

  it("retains source uncertainty and the limits of the executed browser verification", () => {
    const notes = LEONIDA_ATLAS_RELEASES.flatMap(
      (release) => release.highlights,
    ).join(" ");
    expect(notes).toContain("APPROXIMATE");
    expect(notes).toContain("UNKNOWN");
    expect(notes).toContain("GTADB");
    expect(notes).toContain("CC BY 4.0");
    expect(notes).toContain("107 unpositioned");
    const verification = LEONIDA_ATLAS_RELEASES.flatMap(
      (release) => release.verification,
    ).join(" ");
    expect(verification).toContain("Chromium");
    expect(verification).toContain("WebKit");
    expect(verification).toContain("explicitly skipped");
  });
});
