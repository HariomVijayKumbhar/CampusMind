const dotenv = require('dotenv');

// Load .env.local first (local development convention), then .env as fallback.
dotenv.config({ path: '.env.local' });
dotenv.config();

const provider = (process.env.AI_PROVIDER || (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'groq')).toLowerCase();

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

if (provider === 'openrouter') {
  requiredEnvVars.push('OPENROUTER_API_KEY');
} else {
  requiredEnvVars.push('GROQ_API_KEY');
}

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(
    `\n❌ Missing required environment variables:\n  ${missingVars.join('\n  ')}\n`
  );
  console.error('Please set these in .env.local or your hosting platform.');
  process.exit(1);
}

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  aiProvider: provider,
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  rateLimit: {
    api: {
      windowMs: 15 * 60 * 1000,
      max: 100,
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5,
    },
    chat: {
      windowMs: 60 * 1000,
      max: 20,
    },
    document: {
      windowMs: 60 * 60 * 1000,
      max: 10,
    },
  },
  rag: {
    conversationHistoryLimit: 10,
  },
};
