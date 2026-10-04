import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

export default async (req) => {
  const { endpoint } = (await req.json().catch(() => ({}))) || {};
  if (endpoint) await getStore('subscriptions').delete(createHash('sha256').update(endpoint).digest('hex'));
  return Response.json({ ok: true });
};

export const config = { path: '/api/unsubscribe' };
