
function requireSecrets(env = process.env) {
  const service = env.TRIVIA_API_KEY;
  const admin = env.TRIVIA_ADMIN_KEY;
  if (!service || service.length < 24 || service.startsWith('SUBSTITUIR_')) {
    throw new Error('Configure TRIVIA_API_KEY com ao menos 24 caracteres aleatórios no .env.');
  }
  if (!admin || admin.length < 24 || admin.startsWith('SUBSTITUIR_') || admin === service) {
    throw new Error('Configure uma TRIVIA_ADMIN_KEY diferente com ao menos 24 caracteres aleatórios.');
  }
  return { service, admin };
}

module.exports = { requireSecrets };
