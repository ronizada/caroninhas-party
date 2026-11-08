const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
const css = fs.readFileSync(path.resolve(__dirname, '../public/style.css'), 'utf8');

test('V20.20.4 usa tipografia retro legivel em todo o CSS', () => {
  assert.match(html, /family=Chakra\+Petch/);
  assert.match(css, /"Chakra Petch"/);
  assert.doesNotMatch(html, /Pixelify\+Sans/);
  assert.doesNotMatch(css, /"Pixelify Sans"/);
  assert.match(html, /style\.css\?v=20\.20\.4/);
});

test('select retrô nao injeta faixa rosa', () => {
  const rule = css.match(/\.retro-select \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(rule, 'Seletor retro-select nao encontrado');
  assert.doesNotMatch(rule, /linear-gradient\(var\(--pink\)/);
  assert.match(rule, /linear-gradient\(45deg/);
});

test('checkbox retro sem barra rosa decorativa', () => {
  assert.doesNotMatch(css, /\.retro-check-option::after\s*\{/);
  assert.match(css, /\.retro-check-option input\[type="checkbox"\]:checked/);
});

test('campos e botao de entrar compartilham altura e botao nao tem margem', () => {
  assert.match(css, /\.trivia-window \.trivia-join-grid > \.retro-input-wrap\s*\{[^}]*height:\s*52px/s);
  assert.match(css, /\.trivia-window \.trivia-join-grid > \.retro-button\s*\{[^}]*height:\s*52px;[^}]*margin:\s*0/s);
  assert.match(css, /\.trivia-window #trivia-seconds\.trivia-duration-input\s*\{[^}]*Chakra Petch/s);
});
