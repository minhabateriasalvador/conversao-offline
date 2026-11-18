import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return res.status(500).json({ error: 'DATABASE_URL ausente' });

  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT ref, gclid, gbraid, wbraid, criado_em, status, ghl_contact_id
      FROM google_ads_atribuicao
      ORDER BY criado_em DESC
      LIMIT 10
    `;
    return res.status(200).json({ total: rows.length, cliques: rows });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
