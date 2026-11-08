// Pure validation/clock helpers; the database is authoritative for submission deadlines.
const { badRequest } = require('./validation');
const validRoundId = id => typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function validatePlayerAnswer(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      typeof body.playerId !== 'string' || !/^[\w:.\-]{1,120}$/.test(body.playerId) ||
      !['A','B','C','D'].includes(body.optionId)) {
    throw badRequest('Resposta inválida; envie {playerId,optionId} com alternativa A-D');
  }
  return { playerId:body.playerId, optionId:body.optionId };
}
function getExpiryInfo(round, dbNow) {
  if (Number(round.duration_seconds) === 0) return { expiresAt:null, expired:false };
  const end = new Date(round.started_at).getTime() + Number(round.duration_seconds)*1000;
  return { expiresAt:new Date(end).toISOString(), expired: new Date(dbNow).getTime() >= end };
}
module.exports = { validRoundId, validatePlayerAnswer, getExpiryInfo };
