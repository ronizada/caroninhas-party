# Caroninhas Party — V20.14.1

Atualização **visual** das configurações das salas, baseada na V20.14.

- Remove os emojis dos controles "Todos até o fim" e "Sala privada".
- Os dois campos passam a ter o mesmo visual dos seletores de categoria e dificuldade: bordas, altura, tipografia retrô, cor de fundo e sombra.
- No **Quem Sou Eu?**, os dois campos ficam alinhados lado a lado, após o contador de personagens. Em telas pequenas, aparecem um abaixo do outro.
- No **Impostor**, a opção "Sala privada" usa o mesmo componente visual.
- A configuração de senha aparece quando "Sala privada" é marcada, como antes.
- IDs, regras, persistência das preferências, eventos, banco de dados e demais funcionalidades são preservados.
- O ZIP completo não contém `.env` e mantém a configuração `discloud.config` na raiz.

## Arquivos alterados

- `public/index.html`
- `public/style.css`

## Validação

- Sintaxe de `server.js`, `auth.js` e `public/script.js`: OK.
- 15 testes automatizados: OK.
- Conferência de layout desktop/mobile e interação do checkbox usando navegador de teste visual: OK quanto ao layout. A integração completa com Socket.IO não foi testada nessa prévia estática.
