import 'dotenv/config';

const DEV_JWT_SECRET = 'dev-jwt-secret-change-me';
const DEV_REFRESH_SECRET = 'dev-refresh-secret-change-me';
const DEV_ADMIN_PASSWORD = 'Admin@2026';

export function parseDurationMs(input, fallbackMs) {
  if (input == null || input === '') return fallbackMs;
  if (typeof input === 'number' && Number.isFinite(input)) return input;

  const value = String(input).trim();
  if (/^\d+$/.test(value)) return Number(value);

  const match = value.match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) {
    if (fallbackMs != null) return fallbackMs;
    throw new Error(`Unsupported duration format: ${input}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || 'QMS - جمعية البر بصبيا',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()),
  jwt: {
    secret: process.env.JWT_SECRET || DEV_JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshSecret: process.env.REFRESH_SECRET || DEV_REFRESH_SECRET,
    refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '30d',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@bir-sabia.org.sa',
    password: process.env.ADMIN_PASSWORD || DEV_ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME || 'مسؤول النظام',
  },
};

config.jwt.cookieMaxAgeMs = parseDurationMs(config.jwt.expiresIn, 8 * 60 * 60 * 1000);
config.jwt.refreshTokenMaxAgeMs = parseDurationMs(config.jwt.refreshExpiresIn, 30 * 24 * 60 * 60 * 1000);

if (config.env === 'production') {
  const insecureReasons = [];

  if (config.jwt.secret === DEV_JWT_SECRET) insecureReasons.push('JWT_SECRET uses the development default');
  if (config.jwt.refreshSecret === DEV_REFRESH_SECRET) insecureReasons.push('REFRESH_SECRET uses the development default');
  if (config.admin.password === DEV_ADMIN_PASSWORD) insecureReasons.push('ADMIN_PASSWORD uses the default bootstrap password');

  if (insecureReasons.length) {
    throw new Error(`Unsafe production configuration: ${insecureReasons.join('; ')}`);
  }
}
