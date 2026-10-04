import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

// Runs every 15 minutes and sends a push to anyone who is due a reminder.
const SLACK_MS = 8 * 60000;

function localParts(tz) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, mins: Number(p.hour) * 60 + Number(p.minute) };
}
const toMins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export default async () => {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) { console.log('VAPID keys missing'); return; }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const store = getStore('subscriptions');
  const { blobs } = await store.list();
  for (const { key } of blobs) {
    const rec = await store.get(key, { type: 'json' });
    if (!rec?.settings) continue;
    const s = rec.settings, now = localParts(rec.tz);
    if (now.mins < toMins(s.start) || now.mins > toMins(s.end)) continue;
    if (Date.now() - (rec.lastSent || 0) < s.everyMin * 60000 - SLACK_MS) continue;
    const drank = rec.date === now.date ? rec.waterMl : 0;
    if (drank >= s.goalMl) continue;
    const left = s.goalMl - drank;
    const leftText = s.units === 'oz' ? `${Math.round(left / 29.5735)} oz` : `${Math.round(left)} ml`;
    try {
      await webpush.sendNotification(rec.subscription, JSON.stringify({
        title: '💧 Time to drink water', body: `${leftText} to go to hit today's goal.`,
      }));
      rec.lastSent = Date.now();
      await store.setJSON(key, rec);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await store.delete(key);
      else console.error('push failed', err.statusCode, err.body);
    }
  }
};

export const config = { schedule: '*/15 * * * *' };
