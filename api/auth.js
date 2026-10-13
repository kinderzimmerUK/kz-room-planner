export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  const APP_PASSWORD = process.env.APP_PASSWORD;

  if (!APP_PASSWORD) {
    return res.status(500).json({ error: 'Server not configured — APP_PASSWORD env var missing.' });
  }

  if (password && password === APP_PASSWORD) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Incorrect password.' });
}
