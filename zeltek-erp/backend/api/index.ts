// Entry point para Vercel Serverless Functions
// Envuelve la app Express para que funcione como función serverless
import 'dotenv/config';
import app from '../src/app';

export default app;
