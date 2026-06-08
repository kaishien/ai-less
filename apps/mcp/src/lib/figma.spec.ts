import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareExtractedTrees, extractCssNodeTree, parseFigmaNodeUrl } from "./figma.js";
import type { FigmaNode } from "./figma.js";

describe("Figma URL parsing", () => {
  it("extracts file key and node id from design URLs", () => {
    const parsed = parseFigmaNodeUrl(
      "https://www.figma.com/design/0ZbivvUPvSx2hsmgzFkYjP/-NEW-STYLE--?node-id=2564-4411&m=dev",
    );

    assert.equal(parsed.fileKey, "0ZbivvUPvSx2hsmgzFkYjP");
    assert.equal(parsed.nodeId, "2564:4411");
  });

  it("rejects URLs without node-id", () => {
    assert.throws(
      () => parseFigmaNodeUrl("https://www.figma.com/design/abc/title"),
      /node-id/,
    );
  });
});

describe("Figma responsive extraction", () => {
  it("returns auto-clamp tokens for changed descendant values", () => {
    const mobile = extractCssNodeTree(makeNode({
      id: "1:1",
      name: "Card",
      width: 343,
      height: 220,
      paddingTop: 24,
      gap: 16,
      children: [
        makeNode({
          id: "1:2",
          name: "Title",
          type: "TEXT",
          width: 300,
          height: 34,
          fontSize: 28,
          lineHeightPx: 34,
        }),
      ],
    }));
    const desktop = extractCssNodeTree(makeNode({
      id: "2:1",
      name: "Card",
      width: 960,
      height: 420,
      paddingTop: 64,
      gap: 32,
      children: [
        makeNode({
          id: "2:2",
          name: "Title",
          type: "TEXT",
          width: 720,
          height: 56,
          fontSize: 48,
          lineHeightPx: 56,
        }),
      ],
    }));

    const comparison = compareExtractedTrees(mobile, desktop);
    const css = comparison.tokens.map((token) => token.css);

    assert.ok(css.includes("padding-top: auto-clamp(24, 64);"));
    assert.ok(css.includes("gap: auto-clamp(16, 32);"));
    assert.ok(css.includes("font-size: auto-clamp(28, 48);"));
    assert.ok(css.includes("line-height: auto-clamp(34, 56);"));
    assert.deepEqual(comparison.unmatched, {
      mobilePaths: [],
      desktopPaths: [],
    });
  });
});

function makeNode(input: {
  id: string;
  name: string;
  type?: string;
  width: number;
  height: number;
  paddingTop?: number;
  gap?: number;
  fontSize?: number;
  lineHeightPx?: number;
  children?: FigmaNode[];
}): FigmaNode {
  return {
    id: input.id,
    name: input.name,
    type: input.type ?? "FRAME",
    absoluteBoundingBox: {
      x: 0,
      y: 0,
      width: input.width,
      height: input.height,
    },
    paddingTop: input.paddingTop,
    itemSpacing: input.gap,
    style: input.fontSize || input.lineHeightPx
      ? {
          fontSize: input.fontSize,
          lineHeightPx: input.lineHeightPx,
        }
      : undefined,
    children: input.children,
  };
}
