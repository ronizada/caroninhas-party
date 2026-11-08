'use strict';
const { makePool } = require('../src/db');
const { waitForDatabase, initializeDatabase } = require('../src/bootstrap');
require('dotenv').config();
(async () => {
 const pool=makePool();
 try { await waitForDatabase(pool); await initializeDatabase(pool,{importMode:process.env.AUTO_IMPORT||'if_empty'}); }
 finally { await pool.end(); }
})().catch(err=>{console.error(err.message);process.exitCode=1;});
