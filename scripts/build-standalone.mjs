// Builds ONE self-contained HTML file: app code, React, KaTeX, fonts, styles, every exam and every
// image are inlined, so it needs no internet, no login and no Node.js. Open it by double-clicking
// (Chrome, Chromebook, Edge, Firefox, Safari).
//
//   npm run build:standalone      ->  standalone/pregame.html
//
// Run it again after adding or changing an exam in data/exams/.
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(root, 'node_modules/.cache/standalone');
const outFile = path.join(root, 'standalone', 'pregame.html');

fs.rmSync(tmp, { recursive: true, force: true });
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  base: './',
  plugins: [react()],
  build: {
    outDir: tmp,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000, // inline every image and font as a data: URI
    cssCodeSplit: false,
    modulePreload: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 50_000,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: '[name][extname]' } },
  },
});

const files = fs.readdirSync(tmp);
const cssName = files.find((f) => f.endsWith('.css'));
if (!cssName || !files.includes('app.js')) throw new Error(`unexpected build output: ${files.join(', ')}`);
let css = fs.readFileSync(path.join(tmp, cssName), 'utf8');
const js = fs.readFileSync(path.join(tmp, 'app.js'), 'utf8');

// KaTeX ships every font as woff2 + woff + ttf. Every browser that can run this app reads woff2, so drop the
// other two copies (this halves the CSS).
css = css.replace(/,url\(data:font\/(?:woff|ttf);base64,[A-Za-z0-9+/=]+\) ?format\("(?:woff|truetype)"\)/g, '');
if (/data:font\/(?:woff;|ttf)/.test(css)) throw new Error('could not strip the fallback fonts');
// The code is embedded in <style>/<script>. A closing tag inside would end the element early, and an HTML comment
// opener followed by "<script" puts the HTML parser in a state where the real </script> is ignored (the page
// then opens blank). esbuild already writes "</script" as "<\/script" inside strings; check anyway.
if (/<\/style/i.test(css) || /<\/script/i.test(js)) throw new Error('bundle contains a closing tag; cannot inline it');
if (js.includes('<!--') && /<script/i.test(js)) throw new Error('bundle contains "<!--" and "<script"; the inline script would not parse');

// Plain concatenation (never String.replace: "$&" sequences inside the bundle would be rewritten).
const html = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="description" content="Practise past exams in a TestVision-like environment, marked at the end.">',
  '<title>PreGame</title>',
  '<style>',
  css,
  '</style>',
  '</head>',
  '<body>',
  '<div id="root"></div>',
  '<noscript>This page needs JavaScript to run.</noscript>',
  '<script>',
  js,
  '</script>',
  '</body>',
  '</html>',
  '',
].join('\n');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${path.relative(root, outFile)} (${(html.length / 1048576).toFixed(1)} MB)`);
