# Diretrizes para assistentes de programação (Caroninhas Party)

1. **Fonte de verdade:** o código e os testes desta versão têm prioridade. Leia README, docs/referencia-tecnica e docs/RETOMAR_PROJETO.md antes de mudar algo.
2. **Arquitetura:** portal na raiz (`server.js`, `public/*`) e API independente em `services/ronizada-quest`. Não colapse as duas aplicações; não conecte o navegador diretamente com chave de serviço à Trivia.
3. **Preservar jogos:** Impostor, Quem Sou Eu? e Corrida do Conhecimento devem continuar funcionando. Ao criar uma função, altere apenas as partes necessárias.
4. **UI:** NÃO criar tema escuro ou layout genérico isolado para um jogo. Reutilize o design system rosa/creme, janelas retrô e componentes existentes. Chakra Petch e Nunito estão definidas no CSS.
5. **Identidade:** reaproveitar nome, sessão, foto de perfil/avatares em todas as modalidades; não criar campo desnecessário que ignore usuário autenticado.
6. **Corrida:** seleção por tags, dificuldade, 15s padrão (0–30), perguntas sincronizadas, +1 por acerto, 10 para vencer, desempate por perguntas extras e tela de campeão. Resposta após prazo não pontua.
7. **Segredos:** nunca ler/mostrar/commitar `.env` real, tokens, senhas, connection strings ou dados de usuários. Exemplos sempre fictícios.
8. **Banco:** `public` e `trivia` são schemas separados. A API exige papel restrito proprietário de `trivia`; não modificar permissões de produção automaticamente.
9. **Testes:** executar `npm test` na raiz e em `services/ronizada-quest`; verificar desktop e mobile quando alterar CSS/HTML. Se não for possível executar teste integrado, afirmar essa limitação.
10. **Deploy:** não publicar automaticamente em produção. Exigir configuração explícita e manter backups/manifestos de serviços separados.
11. **Reconstituição:** a base local não tem aprovações de perguntas da produção, usuários nem sessões. Não inventar que foram migrados.
12. **Legibilidade:** atualizar README e docs ao mudar contratos, variáveis, dados ou interface.
