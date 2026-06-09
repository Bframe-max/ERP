import 'dotenv/config';

// Todo el sistema opera en hora de Nicaragua (UTC-6) — fija el TZ del proceso
// para que new Date().getFullYear()/toLocaleString()/etc. no dependan del SO.
process.env.TZ = process.env.TZ ?? 'America/Managua';

import app from './app';

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`🚀 ZELTEK ERP API corriendo en http://localhost:${PORT}`);
  console.log(`📦 Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
});
