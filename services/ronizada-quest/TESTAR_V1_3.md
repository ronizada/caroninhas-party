# Testes no Console de ronizada-quest (sem divulgar as chaves)

Todos os comandos devem ser executados no **Console da aplicação `ronizada-quest`**, após o deploy V1.3. `dotenv/config` carrega a `.env` local. NÃO execute no `caroninhas-party`.

## 1. Saúde

```bash
node -r dotenv/config -e 'fetch("http://127.0.0.1:8080/health").then(r=>r.json()).then(console.log).catch(console.error)'
```

Esperado: `status: 'ok'`, `version: '1.3.0'`.

## 2. Resposta imediata e duplicada

Este teste cria a rodada, envia uma resposta, tenta repetição e finaliza. Não mostra nem precisa conhecer o gabarito antecipadamente.

```bash
node -r dotenv/config -e 'const h={"content-type":"application/json","x-api-key":process.env.TRIVIA_API_KEY};const base="http://127.0.0.1:8080/api/v1/rounds";(async()=>{const a=await fetch(base,{method:"POST",headers:h,body:JSON.stringify({roomId:"testev13-"+Date.now(),durationSeconds:15})});const q=await a.json();console.log("CRIAR",a.status,q.roundId,q.expiresAt);if(!a.ok)return;const u=base+"/"+q.roundId;const body=JSON.stringify({playerId:"Roni",optionId:q.options[0].id});for(let i=0;i<2;i++){const r=await fetch(u+"/answers",{method:"POST",headers:h,body});console.log("RESPOSTA",i+1,r.status,await r.text())}const f=await fetch(u+"/finish",{method:"POST",headers:h,body:"{}"});console.log("FINALIZAR",f.status,await f.text())})().catch(e=>console.error(e.message))'
```

Esperado: `CRIAR 201`, `RESPOSTA 1 201`, `RESPOSTA 2 409`, `FINALIZAR 200` com somente a resposta salva para Roni.

## 3. Prazo de 15 segundos

```bash
node -r dotenv/config -e 'const h={"content-type":"application/json","x-api-key":process.env.TRIVIA_API_KEY};const b="http://127.0.0.1:8080/api/v1/rounds";(async()=>{const a=await fetch(b,{method:"POST",headers:h,body:JSON.stringify({roomId:"atrasov13-"+Date.now(),durationSeconds:15})});const q=await a.json();console.log("CRIAR",a.status,q.expiresAt);if(!a.ok)return;await new Promise(r=>setTimeout(r,17000));const url=b+"/"+q.roundId;const r=await fetch(url+"/answers",{method:"POST",headers:h,body:JSON.stringify({playerId:"Roni",optionId:q.options[0].id})});console.log("APOS_PRAZO",r.status,await r.text());const f=await fetch(url+"/finish",{method:"POST",headers:h,body:"{}"});console.log("FINALIZAR",f.status,await f.text())})().catch(e=>console.error(e.message))'
```

Esperado: `APOS_PRAZO 410` e `FINALIZAR 200` com `results: []`.

## 4. Sem cronômetro

Repita o teste de resposta com `durationSeconds:0`; `expiresAt` deve ser `null`. A rodada só fecha via `/finish`.

## 5. Validação em ambiente real

Os testes não provam que a API está segura para uso público até que o backend do Caroninhas Party implemente autenticação dos jogadores. Não exponha a `TRIVIA_API_KEY` no frontend.
