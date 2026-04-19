import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || 'QMS - جمعية البر بصبيا',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshSecret: process.env.REFRESH_SECRET || 'dev-refresh-secret-change-me',
    refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '30d',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@bir-sabia.org.sa',
    password: process.env.ADMIN_PASSWORD || 'Admin@2026',
    name: process.env.ADMIN_NAME || 'مسؤول النظام',
  },
};
