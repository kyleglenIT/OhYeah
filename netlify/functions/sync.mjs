import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys) return new Response('Bad request', { status: 400 });
  const store = getStore('subscriptions');
  const id = createHash('sha256').update(sub.endpoint).digest('hex');
  const prev = (await store.get(id, { type: 'json' })) || {};
  await store.setJSON(id, {
    subscription: sub, tz: body.tz || 'UTC', settings: body.settings,
    date: body.date, waterMl: body.waterMl || 0, lastSent: prev.lastSent || 0,
  });
  return Response.json({ ok: true });
};

export const config = { path: '/api/sync' };
