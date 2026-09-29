import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleJourneyDispatch } from '../lib/journey-mail.js';
import { handleSendNotification } from '../lib/send-notification.js';

export default async function handler(req, res) {
  const query = new URL(req.url || '/', 'https://edm28.fr').searchParams;
  if (req.query?.journey === 'model' || query.get('journey') === 'model') {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).end();
    }
    const source = readFileSync(join(process.cwd(), 'journey-model.js'), 'utf8');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return req.method === 'HEAD' ? res.status(200).end() : res.status(200).send(source);
  }
  if (req.query?.journey === 'dispatch' || query.get('journey') === 'dispatch') return handleJourneyDispatch(req, res);
  if (req.method === 'POST') return handleSendNotification(req, res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    success: true,
    app: 'EDM AUTO',
    api: 'health',
    time: new Date().toISOString()
  });
}
