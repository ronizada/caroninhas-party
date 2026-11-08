"use strict";
// Corrida do Conhecimento — integração isolada com a Ronizada Quest V1.3.
// Credenciais permanecem SOMENTE no servidor Caroninhas Party.
const crypto = require('node:crypto');
const DEFAULT_CATEGORIES = [
  'Conhecimentos gerais','História','Geografia','Ciência e natureza',
  'Cinema','Séries e televisão','Anime e mangá','Videogames',
  'Esportes','Música','Mitologia','Livros e literatura'
];
const DISPLAY = { 'Ciência e natureza':'Ciências', 'Séries e televisão':'Séries e TV', 'Livros e literatura':'Livros' };
const DIFFICULTIES = new Set(['random','easy','medium','hard']);

function displayCategory(value) { return DISPLAY[value] || value; }
function makePublicCategory(row) { return { id:row.name, name:displayCategory(row.name), available:Number(row.available) }; }
function validateTriviaSettings(raw, availableNames) {
  const categories = raw?.categories;
  const difficulty = raw?.difficulty ?? 'random';
  const durationSeconds = raw?.durationSeconds ?? 15;
  if (!Array.isArray(categories) || !categories.length || categories.length > 24 ||
      new Set(categories).size !== categories.length ||
      categories.some(c => typeof c !== 'string' || !availableNames.has(c)))
    throw new Error('Selecione pelo menos uma categoria disponível (sem repetições).');
  if (!DIFFICULTIES.has(difficulty)) throw new Error('Dificuldade inválida.');
  if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 30)
    throw new Error('Tempo deve ser um número inteiro entre 0 e 30 segundos.');
  return { categories:[...categories], difficulty, durationSeconds };
}
function shuffled(items) {
  const a = [...items];
  for (let i=a.length-1;i>0;i--) { const j=crypto.randomInt(i+1); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function makeRace({ app, io, rooms, publicRoom, updateRoom, createRoomCode,
                    resolvePlayerIdentity, sanitizeToken, roomSecret,
                    resolvePrivateSettings, leaveCurrentRoomImmediately, findParticipantByToken,
                    resetReadyForRoom, promoteSpectators }) {
  let categoriesCache = null;
  let categoriesAt = 0;
  async function api(endpoint, options={}) {
    const apiKey=process.env.TRIVIA_API_KEY;
    if (!apiKey) throw new Error('Configure TRIVIA_API_KEY no backend do Caroninhas Party.');
    const apiBase=(process.env.TRIVIA_API_URL || 'https://ronizada-quest.discloud.dev').replace(/\/+$/, '');
    const response = await fetch(`${apiBase}/api/v1${endpoint}`, {
      ...options,
      headers: { 'x-api-key':apiKey, 'content-type':'application/json', ...options.headers },
      signal: AbortSignal.timeout(12000)
    });
    let json;
    try { json=await response.json(); } catch { json={}; }
    if (!response.ok) {
      const error = new Error(json.error || `API de perguntas indisponível (HTTP ${response.status})`);
      error.status = response.status;
      throw error;
    }
    return json;
  }
  async function availableCategories() {
    if (categoriesCache && Date.now()-categoriesAt<60000) return categoriesCache;
    const result=await api('/categories');
    if (!Array.isArray(result.categories)) throw new Error('Resposta de categorias inválida.');
    categoriesCache=result.categories.filter(c=>typeof c.name==='string' && Number(c.available)>0);
    categoriesAt=Date.now();
    return categoriesCache;
  }
  app.get('/api/trivia/categories', async (req,res) => {
    try {
      const categories=await availableCategories();
      res.json({ categories:categories.map(makePublicCategory),
        defaults:DEFAULT_CATEGORIES.filter(c=>categories.some(x=>x.name===c)),
        difficulties:['random','easy','medium','hard'], durationSeconds:15 });
    } catch(error) { res.status(503).json({error:'Não foi possível carregar categorias da Ronizada Quest. Confira a chave da API no servidor.'}); }
  });
  const race = new Map(); // Estado efêmero de partida; nenhum dado novo no banco principal.
  function cleanup(code) {
    const state=race.get(code);
    if (!state) return;
    clearTimeout(state.timeout); clearTimeout(state.transition);
    race.delete(code);
  }
  function stateFor(room) { return race.get(room.code); }
  function playersSnapshot(room,state) {
    return room.players.map(p=>({ token:p.token,name:p.name,avatar:p.avatar,connected:Boolean(p.connected),
      score:state?.scores[p.token] || 0, finalista:state?.tiebreak?.includes(p.token) || false }));
  }
  function currentPayload(room,token) {
    const state=stateFor(room);
    if (!state) return null;
    return { code:room.code,phase:state.phase,roundNumber:state.roundNumber,
      tiebreak:Boolean(state.tiebreak),players:playersSnapshot(room,state),
      question:state.question || null,answerCount:Object.keys(state.answers).length,
      eligibleCount:eligibleTokens(room,state).length,answered:Boolean(state.answers[token]),
      result:state.lastResult || null,winnerToken:state.winnerToken || null };
  }
  function broadcast(room) {
    const state=stateFor(room); if (!state) return;
    room.currentRound = room.currentRound || {};
    room.currentRound.phase = state.phase;
    // Não enviar respostas individuais nem gabarito antes do encerramento.
    const neutral=currentPayload(room,'');
    io.to(room.code).emit('trivia-state',neutral);
    room.players.forEach(p=>{ if(p.socketId) io.to(p.socketId).emit('trivia-my-state',{answered:Boolean(state.answers[p.token]),roundId:state.question?.roundId}); });
    updateRoom(room.code);
  }
  function eligibleTokens(room,state) {
    const all=state.tiebreak || room.players.map(p=>p.token);
    return all.filter(t=>room.players.some(p=>p.token===t));
  }
  function activeTokens(room,state) {
    return eligibleTokens(room,state).filter(t=>room.players.some(p=>p.token===t && p.connected));
  }
  function readyToFinish(room,state) {
    const active=activeTokens(room,state);
    return active.length>0 && active.every(t=>state.answers[t]);
  }
  async function nextRound(room) {
    const state=stateFor(room);
    if (!state || !room.started || !['starting','results'].includes(state.phase)) return;
    clearTimeout(state.timeout);clearTimeout(state.transition);
    state.phase='loading';state.question=null;state.lastResult=null;state.answers={};
    broadcast(room);
    try {
      const candidates=shuffled(room.triviaSettings.categories)
        .sort((a,b)=>(state.categoryUses[a]||0)-(state.categoryUses[b]||0));
      const difficulties=room.triviaSettings.difficulty==='random'
        ? shuffled(['easy','medium','hard']):[room.triviaSettings.difficulty];
      let newRound=null;let lastError=null;
      // Uma tentativa por combinação antes de informar que esgotou o acervo.
      for (const category of candidates) {
        for (const difficulty of difficulties) {
          try {
            newRound=await api('/rounds',{method:'POST',body:JSON.stringify({
              roomId:state.apiRoomId,category,difficulty,durationSeconds:room.triviaSettings.durationSeconds
            })});
            break;
          } catch(error) { if(error.status!==409) throw error; lastError=error; }
        }
        if(newRound) break;
      }
      if(!newRound) throw lastError || new Error('Nenhuma pergunta disponível para essa configuração.');
      if (stateFor(room)!==state || !room.started) return;
      state.roundNumber++;
      state.categoryUses[newRound.category]=(state.categoryUses[newRound.category]||0)+1;
      state.question={roundId:newRound.roundId,question:newRound.question,options:newRound.options,
        category:displayCategory(newRound.category),difficulty:newRound.difficulty,
        startedAt:newRound.startedAt,expiresAt:newRound.expiresAt,
        durationSeconds:newRound.durationSeconds};
      state.phase='question';
      broadcast(room);
      if(newRound.expiresAt) {
        state.timeout=setTimeout(()=>finish(room),Math.max(0,new Date(newRound.expiresAt).getTime()-Date.now()+350));
      }
    } catch(error) {
      if(stateFor(room)!==state) return;
      console.error('Corrida do Conhecimento: falha ao sortear',error.message);
      state.phase='error';state.error='Não foi possível buscar outra pergunta. '+(error.status===409?'O acervo filtrado pode estar esgotado.':'Verifique a conexão com a Trivia API.');
      io.to(room.code).emit('trivia-error',{error:state.error});broadcast(room);
    }
  }
  async function finish(room) {
    const state=stateFor(room);
    if(!state || state.phase!=='question' || !state.question) return;
    state.phase='resolving';clearTimeout(state.timeout);broadcast(room);
    try {
      const result=await api(`/rounds/${encodeURIComponent(state.question.roundId)}/finish`,{method:'POST',body:'{}'});
      if(stateFor(room)!==state || !room.started) return;
      const correct=new Set((result.results||[]).filter(r=>r.correct).map(r=>r.playerId));
      const participants=eligibleTokens(room,state);
      const correctTokens=participants.filter(t=>correct.has(t));
      const answers=participants.map(t=>({token:t,correct:correct.has(t),answered:Boolean(state.answers[t])}));
      if(state.tiebreak) {
        if(correctTokens.length===1) {state.winnerToken=correctTokens[0];state.phase='finished';}
        else if(correctTokens.length>1) state.tiebreak=correctTokens;
        // Se ninguém acertou, os mesmos finalistas tentam novamente.
      } else {
        correctTokens.forEach(t=>{state.scores[t]=Math.min(10,(state.scores[t]||0)+1);});
        const finalists=participants.filter(t=>(state.scores[t]||0)>=10);
        if(finalists.length===1) {state.winnerToken=finalists[0];state.phase='finished';}
        else if(finalists.length>1) state.tiebreak=finalists;
      }
      state.lastResult={correctOptionId:result.correctOptionId,answers,
        tiebreak:Boolean(state.tiebreak),winnerToken:state.winnerToken};
      if(state.phase!=='finished') state.phase='results';
      broadcast(room);
      if(state.phase==='results') state.transition=setTimeout(()=>nextRound(room),4000);
    } catch(error) {
      console.error('Corrida do Conhecimento: falha no encerramento',error.message);
      state.phase='error';state.error='Falha ao corrigir a rodada. Nenhuma pontuação foi alterada.';
      io.to(room.code).emit('trivia-error',{error:state.error});broadcast(room);
    }
  }
  function onPlayerRemoved(room,token) {
    const state=stateFor(room);if(!state) return;
    delete state.scores[token];delete state.answers[token];
    if(state.tiebreak) {
      state.tiebreak=state.tiebreak.filter(t=>t!==token);
      if(state.tiebreak.length===1 && state.phase!=='finished') {
        state.winnerToken=state.tiebreak[0];state.phase='finished';clearTimeout(state.timeout);clearTimeout(state.transition);
      }
    }
    if(state.phase==='question' && readyToFinish(room,state)) void finish(room);
    broadcast(room);
  }
  function onConnectionChange(room) {
    const state=stateFor(room);
    if(state?.phase==='question' && readyToFinish(room,state)) void finish(room);
  }
  function sendCurrent(room,player) {
    const payload=currentPayload(room,player.token);if(!payload) return;
    io.to(player.socketId).emit('trivia-state',payload);
  }
  function registerSocket(socket) {
    socket.on('create-trivia-room', async (request={},callback=()=>{}) => {
      try {
        const categories=await availableCategories();
        const settings=validateTriviaSettings(request, new Set(categories.map(c=>c.name)));
        const identity=await resolvePlayerIdentity(socket,request.name,request.avatar);
        const token=sanitizeToken(request.playerToken);
        if(!identity.name || !token) throw new Error('Informe o nome e um identificador válido.');
        if(findParticipantByToken(token)) throw new Error('Você já está em outra sala. Saia dela antes de criar outra.');
        const privacy=resolvePrivateSettings(request.isPrivate,request.roomPassword);
        leaveCurrentRoomImmediately(socket);
        const code=createRoomCode();
        const player={token,sessionSecret:roomSecret(),socketId:socket.id,name:identity.name,
          avatar:identity.avatar,userId:identity.userId,ready:false,connected:true};
        const room={code,gameType:'trivia',hostToken:token,...privacy,spectators:[],
          players:[player],started:false,currentRound:null,createdAt:Date.now(),
          category:{id:null,name:`${settings.categories.length} categorias`},
          difficulty:{id:null,name:({random:'Aleatória',easy:'Fácil',medium:'Média',hard:'Difícil'})[settings.difficulty]},
          triviaSettings:settings};
        rooms.set(code,room);socket.join(code);
        socket.data.roomCode=code;socket.data.playerToken=token;socket.data.role='player';
        callback({ok:true,room:publicRoom(room),playerToken:token,sessionSecret:player.sessionSecret});
        updateRoom(code);
      } catch(error) {callback({ok:false,error:error.message || 'Falha ao criar sala.'});}
    });
    socket.on('start-trivia-game',async ({code}={},callback=()=>{}) => {
      const room=rooms.get(String(code||'').toUpperCase());
      if(!room || room.gameType!=='trivia' || room.started || room.hostToken!==socket.data.playerToken || socket.data.roomCode!==room.code)
        return callback({ok:false,error:'Somente o host pode iniciar esta sala.'});
      if(room.players.length<2 || !room.players.every(p=>p.connected && p.ready))
        return callback({ok:false,error:'É necessário ter pelo menos 2 jogadores conectados e todos prontos.'});
      room.started=true;
      const state={apiRoomId:`caroninhas-${crypto.randomUUID()}`,phase:'starting',roundNumber:0,
        question:null,answers:{},scores:Object.fromEntries(room.players.map(p=>[p.token,0])),
        categoryUses:{},tiebreak:null,winnerToken:null,lastResult:null,timeout:null,transition:null};
      race.set(room.code,state);room.currentRound={phase:'question'};
      callback({ok:true});broadcast(room);
      void nextRound(room);
    });
    socket.on('restart-trivia-game',({code}={},callback=()=>{})=>{
      const room=rooms.get(String(code||'').toUpperCase());
      const state=room && stateFor(room);
      if(!room || room.gameType!=='trivia' || !state || state.phase!=='finished' ||
         room.hostToken!==socket.data.playerToken || socket.data.roomCode!==room.code)
        return callback({ok:false,error:'Somente o anfitrião pode reabrir a sala após a vitória.'});
      cleanup(room.code);
      room.started=false;room.currentRound=null;
      promoteSpectators(room);resetReadyForRoom(room);
      io.to(room.code).emit('trivia-back-to-lobby');updateRoom(room.code);
      callback({ok:true});
    });
    socket.on('trivia-answer',async ({code,roundId,optionId}={},callback=()=>{}) => {
      const room=rooms.get(String(code||'').toUpperCase());
      const state=room && stateFor(room);
      const token=socket.data.playerToken;
      if(!room || room.gameType!=='trivia' || socket.data.roomCode!==room.code || socket.data.role!=='player' ||
         !room.players.some(p=>p.token===token && p.socketId===socket.id && p.connected) ||
         !state || state.phase!=='question' || state.question?.roundId!==roundId ||
         !eligibleTokens(room,state).includes(token))
        return callback({ok:false,error:'Rodada indisponível ou você não está participando.'});
      if(typeof optionId!=='string' || !state.question.options.some(o=>o.id===optionId))
        return callback({ok:false,error:'Alternativa inválida.'});
      if(state.answers[token] || state.pending?.has(token))
        return callback({ok:false,error:'Você já respondeu ou está enviando sua resposta.'});
      if(!state.pending) state.pending=new Set();state.pending.add(token);
      try {
        await api(`/rounds/${encodeURIComponent(roundId)}/answers`,{method:'POST',
          body:JSON.stringify({playerId:token,optionId})});
        state.answers[token]=optionId;
        callback({ok:true});
        if(stateFor(room)===state && state.question?.roundId===roundId && state.phase==='question') {
          broadcast(room);
          if(readyToFinish(room,state)) void finish(room);
        }
      } catch(error) {
        callback({ok:false,error:error.status===410?'Tempo esgotado.':error.status===409?'Resposta já registrada.': 'Não foi possível registrar a resposta.'});
      } finally { state.pending.delete(token); }
    });
  }
  return {registerSocket,sendCurrent,onPlayerRemoved,onConnectionChange,cleanup,stateFor,currentPayload,
    defaults:DEFAULT_CATEGORIES,availableCategories};
}
module.exports={makeRace,validateTriviaSettings,displayCategory,DEFAULT_CATEGORIES};
