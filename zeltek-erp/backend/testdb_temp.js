const { Client } = require('pg');

const configs = [
  { name: 'Pooler 6543 + pgbouncer + ssl=true', connectionString: 'postgresql://postgres.ecdacjkzlppnwzuenvoh:IMhaE7MNZiVa0gu2@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require' },
  { name: 'Pooler 5432 + ssl=true', connectionString: 'postgresql://postgres.ecdacjkzlppnwzuenvoh:IMhaE7MNZiVa0gu2@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require' },
  { name: 'Pooler 5432 no ssl', connectionString: 'postgresql://postgres.ecdacjkzlppnwzuenvoh:IMhaE7MNZiVa0gu2@aws-0-us-west-1.pooler.supabase.com:5432/postgres' },
];

async function test(cfg) {
  const client = new Client({ connectionString: cfg.connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    const r = await client.query('SELECT 1 as ok');
    console.log(`OK ${cfg.name}: ${JSON.stringify(r.rows[0])}`);
    await client.end();
  } catch(e) {
    console.log(`FAIL ${cfg.name}: ${e.message}`);
  }
}

(async () => {
  for (const cfg of configs) await test(cfg);
})();
