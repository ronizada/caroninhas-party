const test=require('node:test');
const assert=require('node:assert/strict');
const {initializeDatabase, waitForDatabase,assertIsolatedRole}=require('../src/bootstrap');

const allowed={db_user:'caroninhas_trivia_api',privileged:false,public_ddl:false,schema_owner:'caroninhas_trivia_api'};
test('bootstrap nao importa quando base ja possui perguntas',async()=>{
 const calls=[];
 const pool={query:async sql=>{
  calls.push(sql);
  if (/pg_roles/.test(sql)) return {rows:[allowed]};
  if (/COUNT\(\*\)/.test(sql))return {rows:[{total:5247}]};
  return {rows:[{}]};
 }};
 const result=await initializeDatabase(pool,{importMode:'if_empty'});
 assert.equal(result.imported,0);
 assert.equal(calls.length,3);
 assert.match(calls[2],/trivia\.questions/);
});
test('nao inicializa se usuario for superusuario',async()=>{
 await assert.rejects(()=>assertIsolatedRole({query:async()=>({rows:[{...allowed,privileged:true}]})}),/Conexao recusada|Conexão recusada/);
});
test('nao inicializa se usuario tem CREATE no schema public',async()=>{
 await assert.rejects(()=>assertIsolatedRole({query:async()=>({rows:[{...allowed,public_ddl:true}]})}),/Conexao recusada|Conexão recusada/);
});
test('nao inicializa se schema trivia pertencer a outro usuario',async()=>{
 await assert.rejects(()=>assertIsolatedRole({query:async()=>({rows:[{...allowed,schema_owner:'postgres'}]})}),/Conexao recusada|Conexão recusada/);
});
test('waitForDatabase retorna com conexao bem sucedida',async()=>{
 let count=0;
 await waitForDatabase({query:async()=>{count++;return {rows:[{}]};}},1,0);
 assert.equal(count,1);
});
