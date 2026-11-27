const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const output = path.join(__dirname, 'public');
const index = path.join(output, 'index.html');
const html = fs.readFileSync(index, 'utf8');
assert(!/<link\b[^>]*\brel=["']manifest["']/i.test(html), 'Catalogue already links a manifest');

const appHead = `
  <link rel="manifest" href="/pwa/manifest.webmanifest" crossorigin="use-credentials">
  <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-title" content="Blinker Catálogo">
  <style>
    @media (max-width: 700px) {
      .quick-search input { font-size: 16px; min-height: 44px; }
    }
  </style>
`;

fs.cpSync(path.join(__dirname, 'pwa'), path.join(output, 'pwa'), { recursive: true });
// The catalogue may omit the optional HTML head tags.
const title = /<title\b[^>]*>[\s\S]*?<\/title\s*>/i;
const insertionPoint = html.match(title) ?? html.match(/<head(?:\s[^>]*)?>/i)
  ?? html.match(/^\s*<!doctype\s+html[^>]*>\s*(?:<html\b[^>]*>)?/i);
assert(insertionPoint, 'Could not locate the catalogue head');
const offset = insertionPoint.index + insertionPoint[0].length;
fs.writeFileSync(index, html.slice(0, offset) + appHead + html.slice(offset));
