export type DiffLineKind = 'context' | 'add' | 'remove' | 'hunk' | 'meta';

export interface ParsedDiffLine {
  id: string;
  kind: DiffLineKind;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export interface ParsedDiffFile {
  id: string;
  oldPath: string;
  newPath: string;
  displayPath: string;
  additions: number;
  deletions: number;
  lines: ParsedDiffLine[];
}

interface LineCounters {
  oldLine: number | null;
  newLine: number | null;
}

const DIFF_HEADER_PATTERN = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_PATTERN = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseUnifiedDiff(diff: string): ParsedDiffFile[] {
  const files: ParsedDiffFile[] = [];
  let currentFile: ParsedDiffFile | null = null;
  let counters: LineCounters = { oldLine: null, newLine: null };

  for (const rawLine of diff.split(/\r?\n/)) {
    const headerMatch = rawLine.match(DIFF_HEADER_PATTERN);

    if (headerMatch) {
      currentFile = {
        id: `${files.length}-${headerMatch[2]}`,
        oldPath: headerMatch[1],
        newPath: headerMatch[2],
        displayPath: headerMatch[2],
        additions: 0,
        deletions: 0,
        lines: [],
      };
      counters = { oldLine: null, newLine: null };
      files.push(currentFile);
      continue;
    }

    if (!currentFile) {
      if (!rawLine.trim()) {
        continue;
      }

      currentFile = {
        id: 'plain-diff',
        oldPath: 'diff',
        newPath: 'diff',
        displayPath: 'Diff',
        additions: 0,
        deletions: 0,
        lines: [],
      };
      files.push(currentFile);
    }

    if (rawLine.startsWith('--- ')) {
      currentFile.oldPath = trimDiffPath(rawLine.slice(4));
      addMetaLine(currentFile, rawLine);
      continue;
    }

    if (rawLine.startsWith('+++ ')) {
      currentFile.newPath = trimDiffPath(rawLine.slice(4));
      currentFile.displayPath = currentFile.newPath === '/dev/null' ? currentFile.oldPath : currentFile.newPath;
      addMetaLine(currentFile, rawLine);
      continue;
    }

    const hunkMatch = rawLine.match(HUNK_PATTERN);

    if (hunkMatch) {
      counters = {
        oldLine: Number(hunkMatch[1]),
        newLine: Number(hunkMatch[2]),
      };
      currentFile.lines.push({
        id: `${currentFile.id}-${currentFile.lines.length}`,
        kind: 'hunk',
        oldLineNumber: null,
        newLineNumber: null,
        content: rawLine,
      });
      continue;
    }

    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      currentFile.additions += 1;
      currentFile.lines.push({
        id: `${currentFile.id}-${currentFile.lines.length}`,
        kind: 'add',
        oldLineNumber: null,
        newLineNumber: counters.newLine,
        content: rawLine.slice(1),
      });
      counters.newLine = incrementLine(counters.newLine);
      continue;
    }

    if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      currentFile.deletions += 1;
      currentFile.lines.push({
        id: `${currentFile.id}-${currentFile.lines.length}`,
        kind: 'remove',
        oldLineNumber: counters.oldLine,
        newLineNumber: null,
        content: rawLine.slice(1),
      });
      counters.oldLine = incrementLine(counters.oldLine);
      continue;
    }

    if (rawLine.startsWith(' ')) {
      currentFile.lines.push({
        id: `${currentFile.id}-${currentFile.lines.length}`,
        kind: 'context',
        oldLineNumber: counters.oldLine,
        newLineNumber: counters.newLine,
        content: rawLine.slice(1),
      });
      counters.oldLine = incrementLine(counters.oldLine);
      counters.newLine = incrementLine(counters.newLine);
      continue;
    }

    addMetaLine(currentFile, rawLine);
  }

  return files.filter((file) => file.lines.length > 0);
}

function addMetaLine(file: ParsedDiffFile, content: string) {
  file.lines.push({
    id: `${file.id}-${file.lines.length}`,
    kind: 'meta',
    oldLineNumber: null,
    newLineNumber: null,
    content,
  });
}

function trimDiffPath(path: string) {
  if (path === '/dev/null') {
    return path;
  }

  return path.replace(/^[ab]\//, '');
}

function incrementLine(value: number | null) {
  return value === null ? null : value + 1;
}
