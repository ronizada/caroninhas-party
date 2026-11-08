const crypto = require('node:crypto');

function secureMatch(input, secret) {
  if (typeof input !== 'string' || typeof secret !== 'string') return false;
  const a = Buffer.from(input);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function badRequest(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateFilters(body) {
  const filters = { category: body.category ?? null, difficulty: body.difficulty ?? null, type: body.type ?? null };
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && (typeof value !== 'string' || value.length < 1 || value.length > 100)) {
      throw badRequest(`Filtro inválido: ${key}`);
    }
  }
  if (filters.difficulty && !['easy', 'medium', 'hard'].includes(filters.difficulty)) throw badRequest('Dificuldade inválida');
  if (filters.type && !['multiple', 'boolean'].includes(filters.type)) throw badRequest('Tipo inválido');
  return filters;
}

module.exports = { secureMatch, badRequest, validateFilters };
