import dotenv from 'dotenv';
import { rootEnvPath } from './paths.js';

dotenv.config({ path: rootEnvPath });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
};
