'use strict';
require('./src/server').main().catch(error => {
  console.error('[TRIVIA] Falha ao iniciar:', error.message);
  process.exitCode = 1;
});
