// api/signup.js — Vercel serverless function
//
// Storage and email are independent: if one is unconfigured or fails, the
// other still runs. The response reports what actually happened, so a silent
// success is impossible.
//
// Env vars:
//   RESEND_API_KEY, NOTIFY_EMAIL  — email notification (optional)
//   DATABASE_URL                  — Neon Postgres (optional)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const { type, email } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' });
  }
  if (type !== 'application' && type !== 'subscribe') {
    return res.status(400).json({ error: 'bad type' });
  }

  const row = {
    type,
    email: String(email).toLowerCase().trim(),
    name: (body.name || '').trim(),
    phone: (body.phone || '').trim(),
    room: (body.room || '').trim(),
    division: (body.division || '').trim(),
    referral: (body.referral || '').trim(),
    notes: (body.notes || '').trim(),
  };

  const result = { stored: 'skipped', emailed: 'skipped' };

  // ---- database (optional) -------------------------------------------------
  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      await sql`
        create table if not exists signups (
          id bigserial primary key,
          type text not null, email text not null,
          name text default '', phone text default '', room text default '',
          division text default '', referral text default '', notes text default '',
          created_at timestamptz not null default now(),
          unique (type, email)
        )`;
      await sql`
        insert into signups (type, email, name, phone, room, division, referral, notes)
        values (${row.type}, ${row.email}, ${row.name}, ${row.phone},
                ${row.room}, ${row.division}, ${row.referral}, ${row.notes})
        on conflict (type, email) do update set
          name = excluded.name, phone = excluded.phone, room = excluded.room,
          division = excluded.division, referral = excluded.referral,
          notes = excluded.notes, created_at = now()`;
      result.stored = 'ok';
    } catch (err) {
      console.error('db failed:', err);
      result.stored = 'failed: ' + (err.message || String(err));
    }
  }

  // ---- email (optional) ----------------------------------------------------
  if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
    try {
      const subject = row.type === 'application'
        ? `Cancún house application — ${row.name || row.email}`
        : `Cancún list signup — ${row.email}`;

      const text = Object.entries(row)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || 'Cancun <onboarding@resend.dev>',
          to: [process.env.NOTIFY_EMAIL],
          reply_to: row.email,
          subject,
          text,
        }),
      });

      if (r.ok) {
        result.emailed = 'ok';
      } else {
        const detail = await r.text();
        console.error('resend rejected:', r.status, detail);
        result.emailed = `failed: ${r.status} ${detail}`;
      }
    } catch (err) {
      console.error('resend failed:', err);
      result.emailed = 'failed: ' + (err.message || String(err));
    }
  }

  // Success if the signup landed somewhere. Otherwise say so honestly.
  const saved = result.stored === 'ok' || result.emailed === 'ok';
  return res.status(saved ? 200 : 500).json({ ok: saved, ...result });
}