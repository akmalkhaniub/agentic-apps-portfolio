const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:63bnoorIUB@localhost:5432/service_dispatch' });
client.connect().then(async () => {
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log(JSON.stringify(res.rows, null, 2));
  client.end();
}).catch(console.error);
