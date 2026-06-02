import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import githubDarkDefault from 'shiki/themes/github-dark-default.mjs';
import bash from 'shiki/langs/bash.mjs';
import css from 'shiki/langs/css.mjs';
import html from 'shiki/langs/html.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import json from 'shiki/langs/json.mjs';
import jsx from 'shiki/langs/jsx.mjs';
import markdown from 'shiki/langs/markdown.mjs';
import shellscript from 'shiki/langs/shellscript.mjs';
import tsx from 'shiki/langs/tsx.mjs';
import typescript from 'shiki/langs/typescript.mjs';

const languageAliases: Record<string, string> = {
  js: 'javascript',
  md: 'markdown',
  sh: 'shellscript',
  ts: 'typescript',
};

const supportedLanguages = new Set([
  'bash',
  'css',
  'html',
  'javascript',
  'json',
  'jsx',
  'markdown',
  'shellscript',
  'tsx',
  'typescript',
]);

const highlighterPromise = createHighlighterCore({
  themes: [githubDarkDefault],
  langs: [bash, css, html, javascript, json, jsx, markdown, shellscript, tsx, typescript],
  engine: createJavaScriptRegexEngine(),
});

export async function highlightCode(code: string, language?: string) {
  const highlighter = await highlighterPromise;
  const normalizedLanguage = normalizeLanguage(language);

  return highlighter.codeToHtml(code, {
    lang: normalizedLanguage,
    theme: 'github-dark-default',
  });
}

function normalizeLanguage(language?: string) {
  const normalized = language?.trim().toLowerCase();

  if (!normalized) {
    return 'text';
  }

  const aliased = languageAliases[normalized] ?? normalized;
  return supportedLanguages.has(aliased) ? aliased : 'text';
}
