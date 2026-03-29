import { createHash } from 'crypto';

const CORRECT_HASH = '69061231986317e182672aa638419f1dc97eaedb192c53b9ab8736cfa82d8535';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ ok: false });
  }

  const hash = createHash('sha256').update(password).digest('hex');
  if (hash === CORRECT_HASH) {
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ ok: false });
}
