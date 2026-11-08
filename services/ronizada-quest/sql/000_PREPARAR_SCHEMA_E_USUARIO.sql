-- EXECUTE UMA VEZ NO POSTGRES EXISTENTE, conectado como o administrador do BANCO.
-- NÃO EXECUTE ESTE SCRIPT NO ARQUIVO DE MIGRACAO AUTOMATICA DA API.
-- Substitua SOMENTE o valor ABAIXO por uma senha forte e diferente da senha do jogo principal.
-- Se o papel ja existir, altere a senha manualmente; este script nao altera senhas existentes.
DO $setup$
DECLARE
  senha_nova text := 'TROQUE_POR_UMA_SENHA_FORTE';
BEGIN
  IF senha_nova = 'TROQUE_POR_UMA_SENHA_FORTE' OR length(senha_nova) < 24 THEN
    RAISE EXCEPTION 'Edite senha_nova para uma senha forte antes de executar.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'caroninhas_trivia_api') THEN
    EXECUTE format('CREATE ROLE caroninhas_trivia_api LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', senha_nova);
  END IF;
END $setup$;

-- Se um schema chamado trivia ja pertence a outro usuario, PARE e avalie antes de continuar.
DO $setup$
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_namespace n
  WHERE n.nspname = 'trivia'
  AND pg_get_userbyid(n.nspowner) <> 'caroninhas_trivia_api'
 ) THEN
  RAISE EXCEPTION 'Schema trivia ja existe com outro dono; interrompido por seguranca.';
 END IF;
END $setup$;
CREATE SCHEMA IF NOT EXISTS trivia AUTHORIZATION caroninhas_trivia_api;
GRANT USAGE, CREATE ON SCHEMA trivia TO caroninhas_trivia_api;
-- Nao conceder permissao nas tabelas public do Caroninhas Party.
-- PostgreSQL 15+ normalmente impede CREATE em public por usuarios comuns.
-- O app verifica isso na inicializacao e se recusa a iniciar se o papel for privilegiado.
