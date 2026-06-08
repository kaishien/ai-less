import { env, requireEnv } from "./env.js";

const FIGMA_API_BASE_URL = "https://api.figma.com/v1";

const CSS_PROPERTY_LABELS = {
  width: "width",
  height: "height",
  paddingTop: "padding-top",
  paddingRight: "padding-right",
  paddingBottom: "padding-bottom",
  paddingLeft: "padding-left",
  gap: "gap",
  cornerRadius: "border-radius",
  strokeWeight: "border-width",
  fontSize: "font-size",
  lineHeight: "line-height",
  letterSpacing: "letter-spacing",
} as const;

type CssValueKey = keyof typeof CSS_PROPERTY_LABELS;

interface FigmaApiNodeResponse {
  nodes: Record<string, {
    document?: FigmaNode;
  }>;
}

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface FigmaPaint {
  type?: string;
  visible?: boolean;
  color?: FigmaColor;
}

interface FigmaEffect {
  type?: string;
  visible?: boolean;
  color?: FigmaColor;
  offset?: {
    x: number;
    y: number;
  };
  radius?: number;
  spread?: number;
}

interface FigmaTextStyle {
  fontFamily?: string;
  fontPostScriptName?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeightPx?: number;
  letterSpacing?: number;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  cornerRadius?: number;
  strokeWeight?: number;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  effects?: FigmaEffect[];
  characters?: string;
  style?: FigmaTextStyle;
}

export interface ParsedFigmaNodeUrl {
  fileKey: string;
  nodeId: string;
  url: string;
}

export interface CssExtractedNode {
  id: string;
  name: string;
  type: string;
  path: string;
  childIndexPath: string;
  textPreview?: string;
  values: Partial<Record<CssValueKey, number>>;
  colors: {
    background?: string;
    color?: string;
    borderColor?: string;
    boxShadow?: string;
  };
  layout?: {
    display?: "flex";
    flexDirection?: "row" | "column";
  };
  children: CssExtractedNode[];
}

export interface FigmaResponsiveToken {
  path: string;
  match: "path" | "index";
  mobileNodeId: string;
  desktopNodeId: string;
  name: string;
  property: string;
  mobile: number;
  desktop: number;
  css: string;
  autoClamp: string;
}

export interface FigmaResponsiveComparison {
  mobile: {
    source: ParsedFigmaNodeUrl;
    viewportWidth: number;
    tree: CssExtractedNode;
  };
  desktop: {
    source: ParsedFigmaNodeUrl;
    viewportWidth: number;
    tree: CssExtractedNode;
  };
  tokens: FigmaResponsiveToken[];
  unmatched: {
    mobilePaths: string[];
    desktopPaths: string[];
  };
}

export function parseFigmaNodeUrl(rawUrl: string): ParsedFigmaNodeUrl {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid Figma URL: ${rawUrl}`);
  }

  if (!url.hostname.endsWith("figma.com")) {
    throw new Error(`Expected a figma.com URL, got: ${url.hostname}`);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const fileKey = parts[1];
  const nodeIdParam = url.searchParams.get("node-id");

  if (!fileKey || !["design", "file"].includes(parts[0] ?? "")) {
    throw new Error("Figma URL must include /design/<fileKey>/... or /file/<fileKey>/...");
  }

  if (!nodeIdParam) {
    throw new Error("Figma URL must include a node-id query parameter.");
  }

  return {
    fileKey,
    nodeId: nodeIdParam.replace("-", ":"),
    url: rawUrl,
  };
}

export async function fetchFigmaNodeTree(parsedUrl: ParsedFigmaNodeUrl, token = getFigmaToken()): Promise<FigmaNode> {
  const url = new URL(`${FIGMA_API_BASE_URL}/files/${parsedUrl.fileKey}/nodes`);
  url.searchParams.set("ids", parsedUrl.nodeId);

  const response = await fetch(url, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Figma API request failed (${response.status} ${response.statusText}): ${body}`);
  }

  const json = await response.json() as FigmaApiNodeResponse;
  const node = json.nodes[parsedUrl.nodeId]?.document;

  if (!node) {
    throw new Error(`Figma node not found: ${parsedUrl.nodeId}`);
  }

  return node;
}

export function extractCssNodeTree(node: FigmaNode): CssExtractedNode {
  return extractCssNode(node, [], []);
}

export async function compareFigmaResponsiveNodes(input: {
  mobileUrl: string;
  desktopUrl: string;
  mobileViewportWidth?: number;
  desktopViewportWidth?: number;
}): Promise<FigmaResponsiveComparison> {
  const mobileSource = parseFigmaNodeUrl(input.mobileUrl);
  const desktopSource = parseFigmaNodeUrl(input.desktopUrl);
  const [mobileNode, desktopNode] = await Promise.all([
    fetchFigmaNodeTree(mobileSource),
    fetchFigmaNodeTree(desktopSource),
  ]);
  const mobileTree = extractCssNodeTree(mobileNode);
  const desktopTree = extractCssNodeTree(desktopNode);
  const mobileViewportWidth = input.mobileViewportWidth ?? mobileNode.absoluteBoundingBox?.width ?? 375;
  const desktopViewportWidth = input.desktopViewportWidth ?? desktopNode.absoluteBoundingBox?.width ?? 1440;

  return {
    mobile: {
      source: mobileSource,
      viewportWidth: mobileViewportWidth,
      tree: mobileTree,
    },
    desktop: {
      source: desktopSource,
      viewportWidth: desktopViewportWidth,
      tree: desktopTree,
    },
    ...compareExtractedTrees(mobileTree, desktopTree),
  };
}

export function compareExtractedTrees(
  mobileTree: CssExtractedNode,
  desktopTree: CssExtractedNode,
): Pick<FigmaResponsiveComparison, "tokens" | "unmatched"> {
  const mobileNodes = flattenCssTree(mobileTree);
  const desktopNodes = flattenCssTree(desktopTree);
  const desktopByPath = new Map(desktopNodes.map((node) => [node.path, node]));
  const desktopByIndex = new Map(desktopNodes.map((node) => [node.childIndexPath, node]));
  const matchedDesktopPaths = new Set<string>();
  const tokens: FigmaResponsiveToken[] = [];

  for (const mobileNode of mobileNodes) {
    const pathMatch = desktopByPath.get(mobileNode.path);
    const desktopNode = pathMatch ?? desktopByIndex.get(mobileNode.childIndexPath);

    if (!desktopNode) {
      continue;
    }

    matchedDesktopPaths.add(desktopNode.path);

    for (const key of Object.keys(CSS_PROPERTY_LABELS) as CssValueKey[]) {
      const mobile = mobileNode.values[key];
      const desktop = desktopNode.values[key];

      if (mobile === undefined || desktop === undefined || mobile === desktop) {
        continue;
      }

      const property = CSS_PROPERTY_LABELS[key];
      tokens.push({
        path: mobileNode.path,
        match: pathMatch ? "path" : "index",
        mobileNodeId: mobileNode.id,
        desktopNodeId: desktopNode.id,
        name: mobileNode.name,
        property,
        mobile,
        desktop,
        css: `${property}: auto-clamp(${formatNumber(mobile)}, ${formatNumber(desktop)});`,
        autoClamp: `auto-clamp(${formatNumber(mobile)}, ${formatNumber(desktop)})`,
      });
    }
  }

  return {
    tokens,
    unmatched: {
      mobilePaths: mobileNodes
        .filter((node) => !desktopByPath.has(node.path) && !desktopByIndex.has(node.childIndexPath))
        .map((node) => node.path),
      desktopPaths: desktopNodes
        .filter((node) => !matchedDesktopPaths.has(node.path))
        .map((node) => node.path),
    },
  };
}

function getFigmaToken(): string {
  return env("FIGMA_TOKEN")?.trim() || requireEnv("FIGMA_ACCESS_TOKEN");
}

function extractCssNode(node: FigmaNode, namePath: string[], indexPath: number[]): CssExtractedNode {
  const currentNamePath = [...namePath, slugPathPart(node.name)];
  const values: Partial<Record<CssValueKey, number>> = {};

  if (node.absoluteBoundingBox) {
    values.width = node.absoluteBoundingBox.width;
    values.height = node.absoluteBoundingBox.height;
  }

  assignNumber(values, "paddingTop", node.paddingTop);
  assignNumber(values, "paddingRight", node.paddingRight);
  assignNumber(values, "paddingBottom", node.paddingBottom);
  assignNumber(values, "paddingLeft", node.paddingLeft);
  assignNumber(values, "gap", node.itemSpacing);
  assignNumber(values, "cornerRadius", node.cornerRadius);
  assignNumber(values, "strokeWeight", node.strokeWeight);
  assignNumber(values, "fontSize", node.style?.fontSize);
  assignNumber(values, "lineHeight", node.style?.lineHeightPx);
  assignNumber(values, "letterSpacing", node.style?.letterSpacing);

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    path: currentNamePath.join("/"),
    childIndexPath: indexPath.join(".") || "0",
    textPreview: node.characters?.slice(0, 80),
    values,
    colors: extractColors(node),
    layout: extractLayout(node),
    children: (node.children ?? []).map((child, index) => extractCssNode(child, currentNamePath, [...indexPath, index])),
  };
}

function assignNumber(values: Partial<Record<CssValueKey, number>>, key: CssValueKey, value: number | undefined): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    values[key] = value;
  }
}

function extractLayout(node: FigmaNode): CssExtractedNode["layout"] | undefined {
  if (node.layoutMode === "HORIZONTAL") {
    return {
      display: "flex",
      flexDirection: "row",
    };
  }

  if (node.layoutMode === "VERTICAL") {
    return {
      display: "flex",
      flexDirection: "column",
    };
  }

  return undefined;
}

function extractColors(node: FigmaNode): CssExtractedNode["colors"] {
  const fill = firstSolidPaint(node.fills);
  const stroke = firstSolidPaint(node.strokes);
  const shadow = firstShadow(node.effects);
  const colors: CssExtractedNode["colors"] = {};

  if (fill && node.type === "TEXT") {
    colors.color = colorToCss(fill);
  } else if (fill) {
    colors.background = colorToCss(fill);
  }

  if (stroke) {
    colors.borderColor = colorToCss(stroke);
  }

  if (shadow) {
    colors.boxShadow = shadowToCss(shadow);
  }

  return colors;
}

function firstSolidPaint(paints: FigmaPaint[] | undefined): FigmaColor | undefined {
  return paints?.find((paint) => paint.visible !== false && paint.type === "SOLID" && paint.color)?.color;
}

function firstShadow(effects: FigmaEffect[] | undefined): FigmaEffect | undefined {
  return effects?.find((effect) => effect.visible !== false && effect.type === "DROP_SHADOW" && effect.color);
}

function colorToCss(color: FigmaColor): string {
  const red = Math.round(color.r * 255);
  const green = Math.round(color.g * 255);
  const blue = Math.round(color.b * 255);
  const alpha = color.a ?? 1;

  if (alpha >= 1) {
    return `rgb(${red} ${green} ${blue})`;
  }

  return `rgb(${red} ${green} ${blue} / ${formatNumber(alpha)})`;
}

function shadowToCss(effect: FigmaEffect): string {
  const offset = effect.offset ?? { x: 0, y: 0 };
  const color = effect.color ? colorToCss(effect.color) : "rgb(0 0 0 / 0.25)";

  return `${formatNumber(offset.x)}px ${formatNumber(offset.y)}px ${formatNumber(effect.radius ?? 0)}px ${formatNumber(effect.spread ?? 0)}px ${color}`;
}

function flattenCssTree(tree: CssExtractedNode): CssExtractedNode[] {
  return [tree, ...tree.children.flatMap((child) => flattenCssTree(child))];
}

function slugPathPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё:_-]+/giu, "")
    || "unnamed";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
