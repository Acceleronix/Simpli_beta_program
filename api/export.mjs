import { getSql } from '../lib/db.mjs';

function toCsvValue(v) {
  if (v === null || v === undefined) return '""';
  const s = String(v).replace(/"/g, '""').replace(/\r?\n/g, '\n');
  return `"${s}"`;
}

export default async function handler(req, res) {
  const sql = getSql();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Ensure table exists to avoid 500 on first call
    await sql`
      CREATE TABLE IF NOT EXISTS registrations (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        company TEXT,
        date TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const { rows } = await sql`
      SELECT id, name, email, company, date, ip, user_agent, created_at
      FROM registrations
      ORDER BY created_at DESC
    `;

    const header = [
      'id',
      'name',
      'email',
      'company',
      'date',
      'ip',
      'user_agent',
      'created_at'
    ].map(toCsvValue).join(',');

    const lines = [header];
    for (const r of rows) {
      lines.push([
        toCsvValue(r.id),
        toCsvValue(r.name),
        toCsvValue(r.email ?? ''),
        toCsvValue(r.company ?? ''),
        toCsvValue(r.date),
        toCsvValue(r.ip ?? ''),
        toCsvValue(r.user_agent ?? ''),
        toCsvValue(r.created_at)
      ].join(','));
    }

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    console.error('export error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
