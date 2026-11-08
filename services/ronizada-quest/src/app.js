const crypto = require('node:crypto');
const express = require('express');
const { makeRoundOptions, uniqueOptions } = require('./normalize');
const { secureMatch, badRequest, validateFilters } = require('./validation');
const { validRoundId, validatePlayerAnswer, getExpiryInfo } = require('./rounds');

function createApp(pool, secrets) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  function requireKey(header, secret) {
    return (req, res, next) => {
      if (!secureMatch(req.get(header), secret)) return res.status(401).json({ error: 'Chave inválida ou ausente' });
      next();
    };
  }
  const service = requireKey('x-api-key', secrets.service);
  const admin = requireKey('x-admin-key', secrets.admin);

  app.get('/', (req, res) => res.json({ service:'Caroninhas Trivia API', status:'online', version:'1.3.0', docs:'Consulte o README do pacote; acesso à API requer chave privada.' }));

  app.get('/health', async (req, res, next) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'Caroninhas Trivia API', version: '1.3.0' }); }
    catch (error) { res.status(503).json({ status: 'database_unavailable' }); }
  });

  app.get('/api/v1/stats', service, async (req, res) => {
    const result = await pool.query(`SELECT review_status, COUNT(*)::integer AS total FROM trivia.questions GROUP BY review_status ORDER BY review_status`);
    const counts = { pending: 0, approved: 0, blocked: 0, rejected: 0 };
    for (const row of result.rows) counts[row.review_status] = row.total;
    res.json({ total: Object.values(counts).reduce((a, b) => a + b, 0), by_status: counts });
  });

  app.get('/api/v1/categories', service, async (req, res) => {
    const result = await pool.query(`SELECT category_pt AS name,
       COUNT(*)::integer AS total, COUNT(*) FILTER (WHERE review_status = 'approved')::integer AS available
       FROM trivia.questions GROUP BY category_pt ORDER BY category_pt`);
    res.json({ categories: result.rows });
  });

  app.post('/api/v1/rounds', service, async (req, res) => {
    const { roomId, durationSeconds = 15 } = req.body || {};
    if (typeof roomId !== 'string' || !/^[a-zA-Z0-9_:.\-]{1,120}$/.test(roomId)) throw badRequest('roomId obrigatório (1 a 120 caracteres, letras/números/._:-)');
    if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 30) throw badRequest('durationSeconds deve ser inteiro de 0 a 30');
    const { category, difficulty, type } = validateFilters(req.body || {});
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Uma criação de rodada por vez para cada sala.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [roomId]);
      const alreadyOpen = await client.query('SELECT id FROM trivia.rounds WHERE room_id=$1 AND finished_at IS NULL LIMIT 1', [roomId]);
      if (alreadyOpen.rows.length) throw badRequest('A sala já possui uma rodada aberta', 409);
      const result = await client.query(`
        SELECT q.id, q.question_pt, q.correct_answer_pt, q.incorrect_answers_pt,
          q.category_pt, q.difficulty, q.question_type, q.source
        FROM trivia.questions q
        WHERE q.review_status = 'approved'
          AND ($2::text IS NULL OR q.category_pt = $2)
          AND ($3::text IS NULL OR q.difficulty = $3)
          AND ($4::text IS NULL OR q.question_type = $4)
          AND NOT EXISTS (
            SELECT 1 FROM trivia.rounds r WHERE r.room_id = $1 AND r.question_id = q.id
          )
        ORDER BY RANDOM() LIMIT 1`, [roomId, category, difficulty, type]);
      if (!result.rows.length) throw badRequest('Sem perguntas aprovadas disponíveis para estes filtros nesta sala', 409);
      const question = result.rows[0];
      if (!uniqueOptions(question)) throw badRequest('Pergunta aprovada com alternativas equivalentes: desative e corrija este registro', 409);
      const options = makeRoundOptions(question);
      const roundId = crypto.randomUUID();
      const inserted = await client.query(`INSERT INTO trivia.rounds (
        id, room_id, question_id, shuffled_options, correct_option_id, duration_seconds
      ) VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING started_at, started_at + (NULLIF(duration_seconds,0) * INTERVAL '1 second') AS expires_at`, [roundId, roomId, question.id, JSON.stringify(options.options), options.correctOptionId, durationSeconds]);
      await client.query('COMMIT');
      res.status(201).json({
        roundId, questionId: question.id, question: question.question_pt,
        category: question.category_pt, difficulty: question.difficulty,
        type: question.question_type, options: options.options,
        durationSeconds, startedAt: inserted.rows[0].started_at, expiresAt: inserted.rows[0].expires_at,
        attribution: question.source
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  });

  // Consulta de uma rodada para uma sala: nunca inclui o gabarito.
  app.get('/api/v1/rounds/:id', service, async (req, res) => {
    if (!validRoundId(req.params.id)) throw badRequest('roundId inválido');
    const result = await pool.query(`SELECT r.id, r.room_id, r.question_id, r.shuffled_options,
      r.duration_seconds, r.started_at, r.finished_at,
      q.question_pt, q.category_pt, q.difficulty, q.question_type, q.source
      FROM trivia.rounds r JOIN trivia.questions q ON q.id=r.question_id
      WHERE r.id=$1`, [req.params.id]);
    if (!result.rows.length) throw badRequest('Rodada não encontrada', 404);
    const round = result.rows[0];
    const time = await pool.query(`SELECT clock_timestamp() AS db_now`);
    const { expiresAt, expired } = getExpiryInfo(round, time.rows[0].db_now);
    res.json({
      roundId:round.id, roomId:round.room_id, questionId:round.question_id,
      question:round.question_pt, category:round.category_pt, difficulty:round.difficulty,
      type:round.question_type, options:round.shuffled_options,
      durationSeconds:round.duration_seconds, startedAt:round.started_at,
      expiresAt, expired, finished: !!round.finished_at, attribution:round.source
    });
  });

  // Registra UMA resposta irrevogável por jogador; o tempo é medido pelo PostgreSQL.
  // Chamado exclusivamente pelo backend autenticado do jogo (nunca diretamente pelo browser).
  app.post('/api/v1/rounds/:id/answers', service, async (req, res) => {
    if (!validRoundId(req.params.id)) throw badRequest('roundId inválido');
    const { playerId, optionId } = validatePlayerAnswer(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM trivia.rounds WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!found.rows.length) throw badRequest('Rodada não encontrada',404);
      const round = found.rows[0];
      if (round.finished_at) throw badRequest('Rodada já encerrada',409);
      if (!round.shuffled_options.some(option => option.id === optionId)) throw badRequest('Alternativa inexistente nesta rodada');

      // A condição do prazo fica no PRÓPRIO INSERT. Nenhum tempo enviado pelo cliente é confiável.
      const inserted = await client.query(`INSERT INTO trivia.round_answers (round_id, player_id, option_id)
        SELECT r.id, $2, $3 FROM trivia.rounds r WHERE r.id=$1
          AND (r.duration_seconds=0 OR clock_timestamp() < r.started_at + (r.duration_seconds * INTERVAL '1 second'))
        ON CONFLICT (round_id,player_id) DO NOTHING
        RETURNING player_id,received_at`, [round.id,playerId,optionId]);
      if (!inserted.rows.length) {
        const reason = await client.query(`SELECT EXISTS (
          SELECT 1 FROM trivia.round_answers WHERE round_id=$1 AND player_id=$2
        ) AS duplicate,
        (SELECT duration_seconds>0 AND clock_timestamp() >= started_at +
          (duration_seconds * INTERVAL '1 second') FROM trivia.rounds WHERE id=$1) AS expired`, [round.id,playerId]);
        if (reason.rows[0].duplicate) throw badRequest('Jogador já respondeu esta rodada',409);
        if (reason.rows[0].expired) throw badRequest('Prazo de resposta encerrado',410);
        throw badRequest('Resposta não registrada',409);
      }
      await client.query('COMMIT');
      res.status(201).json({ roundId:round.id, playerId, registered:true, receivedAt:inserted.rows[0].received_at });
    } catch (error) {
      await client.query('ROLLBACK').catch(()=>{});
      throw error;
    } finally { client.release(); }
  });

  // Encerra e corrige APENAS respostas previamente gravadas dentro do prazo.
  // Não permite enviar respostas na operação de encerramento (brecha da V1.2).
  app.post('/api/v1/rounds/:id/finish', service, async (req, res) => {
    if (!validRoundId(req.params.id)) throw badRequest('roundId inválido');
    if (req.body && Object.hasOwn(req.body, 'answers')) {
      throw badRequest('Envie as respostas antecipadamente em /rounds/:id/answers; /finish não aceita answers');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM trivia.rounds WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!found.rows.length) throw badRequest('Rodada não encontrada',404);
      const round = found.rows[0];
      if (round.finished_at) throw badRequest('Rodada já encerrada',409);
      const answers = await client.query(`SELECT player_id, option_id FROM trivia.round_answers
        WHERE round_id=$1 AND ( $2::smallint=0 OR received_at < $3::timestamptz +
        ($2::smallint * INTERVAL '1 second')) ORDER BY received_at,player_id`,
        [round.id,round.duration_seconds,round.started_at]);
      await client.query('UPDATE trivia.rounds SET finished_at=clock_timestamp() WHERE id=$1',[round.id]);
      await client.query('COMMIT');
      res.json({ roundId:round.id, correctOptionId:round.correct_option_id,
        results:answers.rows.map(answer=>({playerId:answer.player_id,
          optionId:answer.option_id,correct:answer.option_id===round.correct_option_id})) });
    } catch(error) {
      await client.query('ROLLBACK').catch(()=>{});
      throw error;
    } finally { client.release(); }
  });

  app.get('/api/v1/admin/questions', admin, async (req, res) => {
    const status = req.query.status || 'pending';
    if (!['pending','approved','blocked','rejected'].includes(status)) throw badRequest('Status inválido');
    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw badRequest('Página inválida');
    const results = await pool.query(`SELECT id, question_en, question_pt, category_pt, difficulty,
      question_type, correct_answer_pt, incorrect_answers_pt, quality_flags,
      source_review_status, review_status, review_note
      FROM trivia.questions WHERE review_status=$1 ORDER BY id LIMIT 30 OFFSET $2`, [status, (page - 1) * 30]);
    res.json({ status, page, items: results.rows });
  });

  app.patch('/api/v1/admin/questions/:id/status', admin, async (req, res) => {
    const { status, note, acknowledgeFlags = false } = req.body || {};
    if (!['pending','approved','blocked','rejected'].includes(status)) throw badRequest('Status inválido');
    if (typeof note !== 'string' || note.trim().length < 10 || note.length > 2000) throw badRequest('Informe uma justificativa de 10 a 2000 caracteres');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM trivia.questions WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!found.rows.length) throw badRequest('Pergunta não encontrada', 404);
      const q = found.rows[0];
      if (status === 'approved') {
        if (q.source_review_status !== 'pending') throw badRequest('Pergunta bloqueada/rejeitada na origem; corrija no acervo antes de aprovar', 409);
        if (!uniqueOptions(q)) throw badRequest('Pergunta com alternativas equivalentes não pode ser aprovada', 409);
        if (q.quality_flags.length && acknowledgeFlags !== true) throw badRequest('Existem alertas de qualidade: revise e informe acknowledgeFlags:true', 409);
      }
      await client.query(`UPDATE trivia.questions SET review_status=$2, review_note=$3,
          approved_at = CASE WHEN $2='approved' THEN NOW() ELSE NULL END,
          updated_at = NOW() WHERE id=$1`, [q.id, status, note.trim()]);
      await client.query('COMMIT');
      res.json({ id: q.id, review_status: status });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  });

  app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'JSON inválido' });
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: status >= 500 ? 'Erro interno da API' : error.message });
  });
  return app;
}

module.exports = { createApp };
