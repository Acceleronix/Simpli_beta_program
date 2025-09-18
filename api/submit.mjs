import { getSql } from '../lib/db.mjs';

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      // Avoid abuse with extremely large bodies (>100kb)
      if (data.length > 100 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
}

function isValidEmail(email) {
  if (!email) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  const sql = getSql();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Unsupported Media Type, use application/json' });
    }

    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const company = String(body.company || '').trim();
    const date = String(body.date || '').trim();

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!date) return res.status(400).json({ error: 'Missing date' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });

    const userAgent = String(req.headers['user-agent'] || '');
    const ip = getClientIp(req);
    const ipCountry = String(req.headers['x-vercel-ip-country'] || '').trim() || null; // e.g., "US"
    const ipRegion = String(req.headers['x-vercel-ip-country-region'] || '').trim() || null; // e.g., "CA"

    // Ensure table exists (idempotent)
    await sql`
      CREATE TABLE IF NOT EXISTS registrations (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        company TEXT,
        date TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        ip_country TEXT,
        ip_region TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Backfill for existing tables: add new columns if they don't exist
    await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS ip_country TEXT`;
    await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS ip_region TEXT`;

    const result = await sql`
      INSERT INTO registrations (name, email, company, date, ip, user_agent, ip_country, ip_region)
      VALUES (${name}, ${email || null}, ${company || null}, ${date}, ${ip || null}, ${userAgent || null}, ${ipCountry}, ${ipRegion})
      RETURNING id, created_at
    `;

    const row = result?.rows?.[0] || null;
    return res.status(200).json({
      ok: true,
      id: row?.id ?? null,
      created_at: row?.created_at ?? null
    });
  } catch (err) {
    console.error('submit error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
