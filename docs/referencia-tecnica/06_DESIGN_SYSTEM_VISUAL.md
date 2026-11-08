# 06 — DESIGN SYSTEM VISUAL: IDENTIDADE, TIPOGRAFIA, CORES, MEDIDAS E GRID

## 1. Linguagem de interface

O Caroninhas Party usa **retro desktop lúdico**, influência de interfaces de janelas antigas/pixel art, mas com cartões e campos contemporâneos, legibilidade e cores pastel. O fundo tem grid rosa-lilás claro; conteúdo aparece em janelas creme com barras de título rosa, contorno grafite de 3 px, cantos arredondados e sombras **duras deslocadas** que simulam elementos de brinquedo/adesivo. Estrelas e coração decorativos aparecem no plano de fundo; detalhes em amarelo, lima, menta e laranja contrabalançam o rosa.

**Não usar:** dark mode por jogo, glassmorphism genérico, gradientes neon, cartões sem contorno, botões gigantes inconsistentes, fontes pixel ilegíveis para números pequenos, dashboards SaaS escuros, pictogramas de videogame futurista. A beta escura inicial da Corrida foi explicitamente rejeitada pelo usuário.

## 2. Tokens CSS globais (valores reais de `public/style.css`)

```css
:root {
  --bg: #ead7e2;
  --grid: rgba(116, 84, 92, 0.10);
  --cream: #f7f1df;
  --cream-2: #fff9e9;
  --cream-3: #eadfbe;
  --ink: #2e2524;
  --muted: #786a65;
  --line: #2f2927;
  --pink: #f3a6b9;
  --pink-deep: #df7f9a;
  --orange: #ef9c63;
  --lime: #d8e87e;
  --yellow: #f2d36f;
  --mint: #91c9b6;
  --shadow: #2e2524;
  --soft-shadow: rgba(46, 37, 36, 0.15);
}
```

| Função | Token | Valor | Observação visual |
|---|---|---|---|
| Plano de fundo | `--bg` | `#ead7e2` | rosa/lilás desaturado |
| Grade de fundo | `--grid` | `rgba(116,84,92,.10)` | linhas horizontais/verticais |
| Janela | `--cream` | `#f7f1df` | creme amarelado |
| Formulários | `--cream-2` | `#fff9e9` | creme quase branco |
| Faixas secundárias | `--cream-3` | `#eadfbe` | bege profundo |
| Texto | `--ink` | `#2e2524` | quase preto amarronzado |
| Texto auxiliar | `--muted` | `#786a65` | taupe |
| Contorno | `--line` | `#2f2927` | mesmo caráter do texto |
| Barra / CTA | `--pink` | `#f3a6b9` | rosa-claro |
| Ênfase rosa | `--pink-deep` | `#df7f9a` | destaque de título |
| Ação/alerta | `--orange` | `#ef9c63` | laranja-pêssego |
| Badges e destaques | `--lime` | `#d8e87e` | verde-amarelado |
| Destaque de botão/role | `--yellow` | `#f2d36f` | amarelo claro |
| Estado positivo | `--mint` | `#91c9b6` | menta |
| Sombra | `--shadow` | `#2e2524` | deslocada, borda firme |

### Fundo quadriculado

```css
body {
  margin: 0;
  min-height: 100vh;
  background-color: var(--bg);
  background-image:
    linear-gradient(var(--grid) 1.5px, transparent 1.5px),
    linear-gradient(90deg, var(--grid) 1.5px, transparent 1.5px);
  background-size: 42px 42px;
  color: var(--ink);
  font-family: "Nunito", sans-serif;
}
```

Exibir decorações como conteúdo não interativo em `position: fixed`, `pointer-events: none`, camada atrás da UI (estrelas/coração e outras formas), sem esconder campos nem competir com a leitura.

## 3. Tipografia exata da V20.20.4

O site utiliza **Chakra Petch** (títulos e rotulagem retrô) e **Nunito** (corpo, explicações e vários formulários). A fonte **Pixelify Sans era usada nas versões anteriores, mas foi substituída globalmente por Chakra Petch na V20.20.4** por problemas de legibilidade, principalmente dos numerais como “15”. Não usar Pixelify como família principal ao replicar V20.20.4.

| Papel | Fonte | Peso típico | Observação |
|---|---|---|---|
| Título de jogo | Chakra Petch | 700/800 | grande, alto contraste, não espremido |
| Barra de janela, kicker, badge | Chakra Petch | 700 | letter-spacing em microtítulos |
| Botões retrô | Chakra Petch | 700/800 | preserva estilo sem número ilegível |
| Numerais (timer, pontuação) | Chakra Petch | 700 | legível no 15, 0, 10 |
| Textos longos e descrições | Nunito | 700/800 ou regular conforme seletor | corpo amigável arredondado |
| Alternativas/inputs | Nunito/Chakra Petch conforme classe | ~700/800 | preservar regra da classe original |

As fontes são carregadas pelo Google Fonts em `index.html` via `<link>`, não pela distribuição de fontes locais. **Não incluir arquivos de fonte** na documentação/distribuição. Se a importação externa falhar, os fallbacks são `sans-serif`.

## 4. Estrutura dimensional da janela

Valores reais de referência:

```css
.retro-window, .desktop-widget {
  overflow: hidden;
  border: 3px solid var(--line);
  border-radius: 16px;
  background: var(--cream);
  box-shadow: 8px 9px 0 var(--shadow);
}
.window-bar {
  min-height: 42px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 14px;
  border-bottom: 3px solid var(--line);
  background: var(--pink);
}
.window-dots { display: flex; gap: 7px; align-items: center; }
.dot { width: 11px; height: 11px; border: 2px solid var(--line); border-radius: 50%; }
```

Barra de título: três pontos de cor rosa, laranja e lima à esquerda, nome da janela estilo `*.exe` ao centro, três ícones decorativos à direita. Sempre manter a proporção, linha de separação forte e fundo rosa. `.window-bar.compact` usa min-height de 34 px.

`.app` base: largura `min(1180px, 92vw)`, centrada; padding vertical de 58/72 px na página inicial. Em modo de jogo e viewport desktop, regras específicas centralizam `.app` e limitam altura próxima a `100dvh`. Janelas individuais podem ter `game-page-shell` entre aproximadamente 620 px (modos antigos) e 1120 px/área de Corrida, dependendo da classe de tela.

## 5. Componentes — geometria, hierarquia e interação

| Elemento | Forma | Tratamento |
|---|---|---|
| Janela principal | retângulo arredondado (`~16px`) | fundo creme, borda 3px, sombra sólida deslocada 8×9px |
| Janela modal/card | mesmo contorno gráfico | fundo creme/papel, recortes e linhas divisórias |
| Botão primário | retângulo com cantos arredondados | rosa/lima conforme contexto, borda escura, sombra dura de poucos px |
| Botão secundário | semelhante com fundo creme | menos destaque; nunca menor verticalmente que input adjacente |
| Input | fundo creme-claro, contorno escuro e raio 12-16px | estado focus, placeholder muted, valor legível |
| Select | seta integrada | **sem barra rosa decorativa vertical** na V20.20.4 |
| Checkbox | bloco normalizado | **sem faixa rosa ao lado** na V20.20.4 |
| Tag categoria | pílula, contorno escuro | selecionada em rosa com check; desmarcada creme com símbolo `+` |
| Cartão de player | avatar, nome, status, badge | sem identidade inventada |
| Torre | 10 retângulos empilhados | preenchimento baixo→cima, cor do jogador, texto N/10 |
| Ícones | sprite SVG em `index.html` | traço consistente; símbolos infantis/decorativos pontuais |

**Refinamentos formalizados na V20.20.4:** inputs de código e senha e CTA Entrar na Corrida têm **52 px de altura externa**, alinhados verticalmente; o número do tempo usa Chakra Petch; linha rosa decorativa de `.retro-select`/`.retro-check-option` foi removida. Esses detalhes foram explicitamente solicitados pelo usuário e são **invariantes de aceitação**.

## 6. Sistema de espaçamento e proporção

O CSS não declara um sistema único de tokens `--space-*`; contém valores concretos contextuais. Para réplica pixel aproximada, medir a captura visual de referência e reutilizar os números do CSS em vez de inventar um design system de 8px sem conferir. Padrões recorrentes: gaps de 7–20px, paddings de 12–30px, contornos 2–3px, raios 10–18px, microtítulos 10–13px, texto geral 13–17px, títulos de jogos `clamp()` entre ~28 e ~56px. Valores exatos variam pela tela.

## 7. Especificidade, cascata e regressão

`public/style.css` possui mais de 6.000 linhas e dezenas de regras sobrepostas de versões históricas. O visual real é determinado pela **cascata final** e classes do `body`, não pela primeira declaração do seletor. Para uma réplica consistente:

1. Capturar estilos computados em cada tela (Chrome DevTools); comparar com seletor e `@media` ativo.
2. Não pegar CSS da V20.20 beta escura ou da V20.20.1 e tratá-lo como final.
3. Não eliminar estilos do Impostor ou Quem Sou Eu? ao simplificar classes de Corrida.
4. Alterar apenas regras específicas ou consolidar a cascata com testes de regressão visual antes de publicar.

## 8. Responsive e viewport

Breakpoints visíveis no arquivo incluem **390**, **720/721**, **980** px e outros associados às telas antigas. A lógica geral é:

- **Desktop**: biblioteca em grade; janelas centralizadas; home da Corrida com categorias à esquerda e configurações/rooms à direita; tela da partida com pergunta ~60% e torres ~40%.
- **Tablet estreito**: configurações colapsam progressivamente; controles e cartões reorganizados.
- **Mobile**: uma coluna; janelas com largura responsiva; torres antes da pergunta e lista interna com overflow horizontal quando necessário; inputs e botões viram linhas verticais; rolagem habilitada conforme conteúdo.
- **Rolagem:** preferência é caber na viewport desktop, mas telas pequenas/zoom acessível podem ter scroll **interno seguro**. Não bloquear scroll global deixando o botão de criar sala inacessível.

## 9. Identidade por modalidade

Impostor usa detalhes amarelos na `.window-bar.impostor-bar`; Quem Sou Eu? enfatiza cartões com imagem; Corrida usa mesmas superfícies/rosa e novas tags/torres. Diferenças de modalidade não devem criar um **novo sistema de cores**.

## 10. Referências de UI e capturas

As imagens em `referencias-visuais/` são referências de composição/escala, com duas distinções: `captura-*` deriva de imagem enviada pelo usuário, enquanto `preview-*` é prévia de desenvolvimento. Em qualquer conflito visual, priorize a **versão realmente publicada que você estiver reconstruindo** e os estilos efetivos da V20.20.4. Nenhuma imagem de referência substitui HTML funcional nem contagem do banco.

### Checklist visual de fidelidade

- [ ] Rosa quadriculado, creme, borda 3px, sombra dura e janela rosa.
- [ ] Chakra Petch nos títulos/controles de destaque e Nunito no corpo.
- [ ] Mesmo componente nome/avatar em todos os jogos, incluindo foto de conta.
- [ ] Tags pílula clicáveis e 24 categorias quando API disponível.
- [ ] Número 15 sempre legível com controle –/+, sem setas sobrepostas.
- [ ] Input código, input senha e botão Entrar visualmente alinhados.
- [ ] Sem faixas rosas residuais em select/checkbox.
- [ ] Jogo usa 10 blocos por torre, dados atualizados sem manipular score no browser.
- [ ] Tela final com coroa, avatar, classificação e ação de revanche.
- [ ] Mobile sem corte/estouro horizontal de página.
