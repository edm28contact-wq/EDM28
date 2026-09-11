import { handleSendNotification } from '../lib/send-notification.js';

export default async function handler(req, res) {
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