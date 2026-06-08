import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  compareFigmaResponsiveNodes,
  extractCssNodeTree,
  fetchFigmaNodeTree,
  parseFigmaNodeUrl,
} from "../lib/figma.js";
import { jsonText } from "../lib/json-response.js";

export function registerFigmaTools(server: McpServer): void {
  server.registerTool(
    "figma_get_node_tree",
    {
      description:
        "Fetch a selected Figma node URL and return a normalized CSS-oriented tree for that node and its descendants.",
      inputSchema: {
        url: z.string().url().describe("Figma design/file URL with a node-id query parameter."),
      },
    },
    async ({ url }) => {
      const source = parseFigmaNodeUrl(url);
      const node = await fetchFigmaNodeTree(source);

      return jsonText({
        source,
        viewportWidth: node.absoluteBoundingBox?.width,
        tree: extractCssNodeTree(node),
      });
    },
  );

  server.registerTool(
    "figma_compare_responsive_nodes",
    {
      description:
        "Compare mobile and desktop Figma node URLs and return CSS-oriented value differences across matched descendants.",
      inputSchema: {
        mobileUrl: z.string().url().describe("Mobile Figma node URL with a node-id query parameter."),
        desktopUrl: z.string().url().describe("Desktop Figma node URL with a node-id query parameter."),
        mobileViewportWidth: z
          .number()
          .positive()
          .optional()
          .describe("Optional mobile viewport width. Defaults to the mobile node width, then 375."),
        desktopViewportWidth: z
          .number()
          .positive()
          .optional()
          .describe("Optional desktop viewport width. Defaults to the desktop node width, then 1440."),
      },
    },
    async ({ mobileUrl, desktopUrl, mobileViewportWidth, desktopViewportWidth }) =>
      jsonText(await compareFigmaResponsiveNodes({
        mobileUrl,
        desktopUrl,
        mobileViewportWidth,
        desktopViewportWidth,
      })),
  );

  server.registerTool(
    "figma_extract_auto_clamp_tokens",
    {
      description:
        "Extract mobile/desktop Figma value pairs as auto-clamp CSS suggestions for applying in an existing code block.",
      inputSchema: {
        mobileUrl: z.string().url().describe("Mobile Figma node URL with a node-id query parameter."),
        desktopUrl: z.string().url().describe("Desktop Figma node URL with a node-id query parameter."),
        mobileViewportWidth: z
          .number()
          .positive()
          .optional()
          .describe("Optional mobile viewport width. Defaults to the mobile node width, then 375."),
        desktopViewportWidth: z
          .number()
          .positive()
          .optional()
          .describe("Optional desktop viewport width. Defaults to the desktop node width, then 1440."),
      },
    },
    async ({ mobileUrl, desktopUrl, mobileViewportWidth, desktopViewportWidth }) => {
      const comparison = await compareFigmaResponsiveNodes({
        mobileUrl,
        desktopUrl,
        mobileViewportWidth,
        desktopViewportWidth,
      });

      return jsonText({
        mobile: comparison.mobile.source,
        desktop: comparison.desktop.source,
        mobileViewportWidth: comparison.mobile.viewportWidth,
        desktopViewportWidth: comparison.desktop.viewportWidth,
        tokens: comparison.tokens,
        unmatched: comparison.unmatched,
      });
    },
  );
}
