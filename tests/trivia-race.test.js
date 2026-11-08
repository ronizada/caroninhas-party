'use strict';
const {test} = require('node:test');
const assert=require('node:assert/strict');
process.env.TRIVIA_API_KEY='test-key-not-production';
const {makeRace,validateTriviaSettings,DEFAULT_CATEGORIES,displayCategory}=require('../trivia-race');

test('Categorias configuradas correspondem aos nomes exatos da API; dificuldade e tempo são validados',()=>{
  const names=new Set([...DEFAULT_CATEGORIES]);
  assert.equal(DEFAULT_CATEGORIES.length,12);
  assert.equal(displayCategory('Ciência e natureza'),'Ciências');
  assert.equal(displayCategory('Séries e televisão'),'Séries e TV');
  assert.equal(displayCategory('Livros e literatura'),'Livros');
  assert.deepEqual(validateTriviaSettings({categories:['História','Música'],difficulty:'random',durationSeconds:0},names),{
    categories:['História','Música'],difficulty:'random',durationSeconds:0});
  for(const invalid of [[],['Nenhuma'],['História','História']])
    assert.throws(()=>validateTriviaSettings({categories:invalid},names));
  for(const durationSeconds of [-1,31,1.5,'15'])
    assert.throws(()=>validateTriviaSettings({categories:['História'],durationSeconds},names));
  assert.throws(()=>validateTriviaSettings({categories:['História'],difficulty:'impossible'},names));
});

test('Duas respostas são registradas individualmente e apenas o acerto eleva uma torre',async()=>{
  const originalFetch=global.fetch;
  let roundCounter=0;let answers=[];let finishCount=0;
  global.fetch=async(url,init={})=>{
    assert.equal(init.headers['x-api-key'],'test-key-not-production');
    const pathname=new URL(url).pathname;
    let data,status=200;
    if(pathname.endsWith('/categories')) data={categories:DEFAULT_CATEGORIES.map(name=>({name,available:20}))};
    else if(pathname.endsWith('/rounds')) {
      const q=JSON.parse(init.body);
      assert.equal(q.durationSeconds,0);
      assert.ok(DEFAULT_CATEGORIES.includes(q.category));
      assert.ok(['easy','medium','hard'].includes(q.difficulty));
      roundCounter++;status=201;
      data={roundId:`round-${roundCounter}`,question:'Qual opção?',options:[{id:'A',text:'Sim'},{id:'B',text:'Não'}],
        category:q.category,difficulty:q.difficulty,durationSeconds:0,startedAt:new Date().toISOString(),expiresAt:null};
    } else if(pathname.endsWith('/answers')) {
      const a=JSON.parse(init.body);answers.push(a);data={registered:true};status=201;
    } else if(pathname.endsWith('/finish')) {
      finishCount++;
      data={correctOptionId:'A',results:answers.map(a=>({playerId:a.playerId,optionId:a.optionId,correct:a.optionId==='A'}))};
    } else throw new Error('unexpected request '+pathname);
    return {ok:true,status,json:async()=>data};
  };
  try {
    const handlers={};const events=[];const rooms=new Map();
    const app={get(path,fn){handlers[path]=fn;}};
    const io={to(target){return {emit(evt,payload){events.push({target,evt,payload});}};}};
    const createSocket=(id,token)=>({id,data:{playerToken:token,roomCode:'TEST',role:'player'},
      on(name,fn){this.handlers[name]=fn;},handlers:{},join(){}});
    const host=createSocket('socket-a','roni');
    const other=createSocket('socket-b','antonio');
    const room={code:'TEST',gameType:'trivia',hostToken:'roni',started:false,
      triviaSettings:{categories:[...DEFAULT_CATEGORIES],difficulty:'random',durationSeconds:0},
      players:[{token:'roni',socketId:'socket-a',name:'Roni',avatar:'cat',ready:true,connected:true},
               {token:'antonio',socketId:'socket-b',name:'Antonio',avatar:'dog',ready:true,connected:true}],
      spectators:[]};
    rooms.set('TEST',room);
    const race=makeRace({app,io,rooms,publicRoom:r=>({code:r.code}),updateRoom(){},
      createRoomCode:()=> 'RACE', resolvePlayerIdentity:()=>({name:'Roni',avatar:'cat'}),sanitizeToken:x=>x,
      roomSecret:()=> 'secret', resolvePrivateSettings:()=>({isPrivate:false,passwordConfig:null}),
      leaveCurrentRoomImmediately(){},findParticipantByToken:()=>null});
    race.registerSocket(host);race.registerSocket(other);
    await new Promise(resolve=>host.handlers['start-trivia-game']({code:'TEST'},resolve));
    await new Promise(resolve=>setImmediate(resolve));
    const state=race.stateFor(room);
    assert.equal(state.roundNumber,1);
    assert.equal(state.phase,'question');
    assert.ok(!JSON.stringify(events.filter(e=>e.evt==='trivia-state')).includes('correctOptionId'));
    const rid=state.question.roundId;
    const roni=await new Promise(resolve=>host.handlers['trivia-answer']({code:'TEST',roundId:rid,optionId:'A'},resolve));
    assert.equal(roni.ok,true);
    const dup=await new Promise(resolve=>host.handlers['trivia-answer']({code:'TEST',roundId:rid,optionId:'B'},resolve));
    assert.equal(dup.ok,false);
    const antonio=await new Promise(resolve=>other.handlers['trivia-answer']({code:'TEST',roundId:rid,optionId:'B'},resolve));
    assert.equal(antonio.ok,true);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(finishCount,1);
    assert.equal(state.phase,'results');
    assert.equal(state.scores.roni,1);
    assert.equal(state.scores.antonio,0);
    assert.ok(events.some(e=>e.evt==='trivia-state' && e.payload.result?.correctOptionId==='A'));
    race.cleanup('TEST');
  } finally {global.fetch=originalFetch;}
});
