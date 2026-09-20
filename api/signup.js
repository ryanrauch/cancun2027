// api/signup.js — Vercel serverless function
// Handles both form types from the landing page:
//   { type: "application", name, email, phone, room, division, referral, notes }
//   { type: "subscribe",   email, name }
//
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   DATABASE_URL   — injected automatically by `vercel install neon`
//   RESEND_API_KEY — optional, sends you an email on each signup
//   NOTIFY_EMAIL   — where those notifications go
//
// Either storage path is optional: set only RESEND_API_KEY and you get
// emails with no database; set only DATABASE_URL and it just stores rows.

import { neon } from '@neondatabase/serverless';

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

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
    email: email.toLowerCase().trim(),
    name: (body.name || '').trim(),
    phone: (body.phone || '').trim(),
    room: (body.room || '').trim(),
    division: (body.division || '').trim(),
    referral: (body.referral || '').trim(),
    notes: (body.notes || '').trim(),
  };

  try {
    if (sql) {
      await sql`
        insert into signups (type, email, name, phone, room, division, referral, notes)
        values (${row.type}, ${row.email}, ${row.name}, ${row.phone},
                ${row.room}, ${row.division}, ${row.referral}, ${row.notes})
        on conflict (type, email) do update set
          name = excluded.name,
          phone = excluded.phone,
          room = excluded.room,
          division = excluded.division,
          referral = excluded.referral,
          notes = excluded.notes,
          created_at = now()
      `;
    }

    if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
      const subject = row.type === 'application'
        ? `Cancún house application — ${row.name || row.email}`
        : `Cancún list signup — ${row.email}`;

      const lines = Object.entries(row)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Cancún <onboarding@resend.dev>',
          to: [process.env.NOTIFY_EMAIL],
          subject,
          text: lines,
        }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('signup failed', err);
    return res.status(500).json({ error: 'could not save' });
  }
}
