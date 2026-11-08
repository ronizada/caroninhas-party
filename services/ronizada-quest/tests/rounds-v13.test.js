const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { validatePlayerAnswer, getExpiryInfo } = require('../src/rounds');
const ROUND_ID = '123e4567-e89b-42d3-a456-426614174000';

// Este teste roda sem npm install, usando apenas uma camada fina que simula o Express.
const oldLoad=Module._load;
Module._load=function(request,parent,isMain) {
  if(request==='express') {
    const create=()=>{
      const routes=new Map();
      return { routes, disable(){}, use(){}, get(p,...handlers){routes.set('GET '+p,handlers)},
        post(p,...handlers){routes.set('POST '+p,handlers)}, patch(p,...handlers){routes.set('PATCH '+p,handlers)} };
    };
    create.json=()=>((req,res,next)=>next());
    return create;
  }
  return oldLoad.call(this,request,parent,isMain);
};
const { createApp }=require('../src/app');
Module._load=oldLoad;
const secrets={service:'a'.repeat(30),admin:'b'.repeat(30)};
function fakeDb(duration=15) {
  const round={ id:ROUND_ID, shuffled_options:[{id:'A',text:'Wrong'},{id:'B',text:'Right'}],
    correct_option_id:'B', duration_seconds:duration, started_at:new Date('2026-10-24T02:00:00Z'), finished_at:null};
  let expired=false;
  const answers=new Map();
  const executed=[];
  const query=async(sql,values=[])=>{
    executed.push(sql);
    if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('SELECT * FROM trivia.rounds WHERE'))return {rows:[round]};
    if(sql.includes('INSERT INTO trivia.round_answers')){
      if((expired&&duration>0)||answers.has(values[1]))return {rows:[]};
      answers.set(values[1],{player_id:values[1],option_id:values[2],received_at:new Date()});
      return {rows:[{player_id:values[1],received_at:new Date()}]};
    }
    if(sql.includes('SELECT EXISTS ('))return {rows:[{duplicate:answers.has(values[1]),expired:expired&&duration>0}]};
    if(sql.includes('SELECT player_id, option_id FROM trivia.round_answers'))return {rows:[...answers.values()]};
    if(sql.includes('UPDATE trivia.rounds SET finished_at')){round.finished_at=new Date();return {rows:[]};}
    throw Error('Unexpected SQL '+sql.substring(0,90));
  };
  const client={query,release(){}};
  return {pool:{connect:async()=>client},round,answers,executed,setExpired(v){expired=v}};
}
async function send(app,method,path,{body={},id=ROUND_ID,key=secrets.service}={}) {
  const handlers=app.routes.get(method+' '+path);
  assert.ok(handlers,'Missing endpoint '+path);
  const req={body,params:{id},get:(name)=>name==='x-api-key'?key:null};
  const res={statusCode:200, payload:null, status(s){this.statusCode=s;return this},json(o){this.payload=o;return this}};
  for(const handler of handlers) {
    let nextCalled=false;
    await handler(req,res,()=>{nextCalled=true});
    if(!nextCalled)break;
  }
  return {status:res.statusCode,body:res.payload};
}

const answerPath='/api/v1/rounds/:id/answers';
const finishPath='/api/v1/rounds/:id/finish';
test('registra e corrige respostas individuais antes do prazo, sem aceitar answers no /finish',async()=>{
  const db=fakeDb();const app=createApp(db.pool,secrets);
  const good=await send(app,'POST',answerPath,{body:{playerId:'Roni',optionId:'B'}});
  assert.equal(good.status,201); assert.equal(good.body.registered,true);
  const bad=await send(app,'POST',answerPath,{body:{playerId:'Antonio',optionId:'A'}});
  assert.equal(bad.status,201);
  await assert.rejects(send(app,'POST',finishPath,{body:{answers:[{playerId:'Intruso',optionId:'B'}]}}),e=>e.status===400);
  assert.equal(db.round.finished_at,null);
  const finished=await send(app,'POST',finishPath);
  assert.equal(finished.status,200);
  assert.equal(finished.body.correctOptionId,'B');
  assert.deepEqual(finished.body.results.map(x=>[x.playerId,x.correct]),[['Roni',true],['Antonio',false]]);
  assert.equal(db.answers.size,2);
  await assert.rejects(send(app,'POST',finishPath),e=>e.status===409);
  await assert.rejects(send(app,'POST',answerPath,{body:{playerId:'Terceiro',optionId:'B'}}),e=>e.status===409);
});
test('bloqueia resposta de um mesmo jogador duas vezes',async()=>{
  const db=fakeDb();const app=createApp(db.pool,secrets);
  await send(app,'POST',answerPath,{body:{playerId:'Roni',optionId:'A'}});
  await assert.rejects(send(app,'POST',answerPath,{body:{playerId:'Roni',optionId:'B'}}),e=>e.status===409);
  assert.equal(db.answers.get('Roni').option_id,'A');
});
test('resposta tardia é rejeitada; finish tardio só corrige respostas salvas',async()=>{
  const db=fakeDb();const app=createApp(db.pool,secrets);
  await send(app,'POST',answerPath,{body:{playerId:'Roni',optionId:'B'}});
  db.setExpired(true);
  await assert.rejects(send(app,'POST',answerPath,{body:{playerId:'Antonio',optionId:'B'}}),e=>e.status===410);
  const f=await send(app,'POST',finishPath);
  assert.deepEqual(f.body.results.map(x=>x.playerId),['Roni']);
});
test('sem cronômetro (0 segundos) não rejeita por expiração',async()=>{
  const db=fakeDb(0);const app=createApp(db.pool,secrets);db.setExpired(true);
  const r=await send(app,'POST',answerPath,{body:{playerId:'Roni',optionId:'B'}});
  assert.equal(r.status,201);
  const f=await send(app,'POST',finishPath);
  assert.equal(f.body.results[0].correct,true);
});
test('recusa chave ausente e identificadores inválidos',async()=>{
  const db=fakeDb();const app=createApp(db.pool,secrets);
  const r=await send(app,'POST',answerPath,{body:{playerId:'Roni',optionId:'B'},key:'invalid'});
  assert.equal(r.status,401);
  await assert.rejects(send(app,'POST',answerPath,{id:'invalid',body:{playerId:'Roni',optionId:'B'}}),e=>e.status===400);
  assert.throws(()=>validatePlayerAnswer({playerId:'Roni',optionId:'Q'}),e=>e.status===400);
});
test('calcula vencimento e desabilita expiração para 0',()=>{
  const t='2026-10-24T10:00:00Z';
  assert.deepEqual(getExpiryInfo({started_at:t,duration_seconds:15},'2026-10-24T10:00:16Z'),{expiresAt:'2026-10-24T10:00:15.000Z',expired:true});
  assert.deepEqual(getExpiryInfo({started_at:t,duration_seconds:0},'2027-10-24T10:00:00Z'),{expiresAt:null,expired:false});
});
