'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const publicDir=path.join(__dirname,'../public');
const html=fs.readFileSync(path.join(publicDir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(publicDir,'script.js'),'utf8');
const css=fs.readFileSync(path.join(publicDir,'style.css'),'utf8');

test('a tela de campeão tem identidade, placar e ações do host',()=>{
  for(const id of ['trivia-winner-screen','trivia-winner-avatar','trivia-winner-name',
    'trivia-final-ranking','trivia-winner-replay','trivia-winner-wait-host','trivia-winner-error']) {
      assert.ok(html.includes(`id="${id}"`),`Elemento ausente: ${id}`);
    }
  assert.match(js,/function triviaShowWinner\(state\)/);
  assert.match(js,/state\.winnerToken/);
  assert.match(js,/showScreen\(triviaWinnerScreen\)/);
  assert.match(js,/restart-trivia-game/);
});
test('o botão de tempo tem valor visível, sem herdar o seletor',()=>{
  assert.match(html,/id="trivia-seconds" class="trivia-duration-input" type="number"/);
  assert.ok(!html.includes('id="trivia-seconds" class="retro-select"'));
  assert.ok(html.includes('id="trivia-time-minus"'));
  assert.ok(html.includes('id="trivia-time-plus"'));
  assert.match(css,/background-image:none/);
  assert.match(js,/function triviaNormalizeSeconds\(/);
});
test('a Corrida mantém os estilos isolados e o rodapé abaixo dos jogos',()=>{
  const i=html.indexOf('id="trivia-winner-screen"');
  const f=html.indexOf('<footer class="site-credit"');
  assert.ok(i>=0&&f>i);
  assert.match(css,/\.trivia-winner-hero/);
  assert.match(css,/\.trivia-final-entry/);
});
