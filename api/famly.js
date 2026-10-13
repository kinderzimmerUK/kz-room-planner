// Famly GraphQL proxy — tries multiple auth headers
const SITES = {
  berkhamsted:      { siteId: '9b49fa5c-861d-4032-a166-83a841f2f347', name: 'Berkhamsted' },
  amersham:         { siteId: '4691dfa2-9a7e-42c4-af1a-aad5cb5c2823', name: 'Amersham' },
  chelmsford:       { siteId: '790d0804-cf74-461c-a493-4204151de5bf', name: 'Chelmsford' },
  godalming:        { siteId: '15fd3a01-d855-4b1a-bbf8-fd68945b864d', name: 'Godalming' },
  muswell_hill:     { siteId: '47de485c-86cc-4015-801a-7e1b8d023b03', name: 'Muswell Hill' },
  south_kensington: { siteId: '7db4932c-0407-4a92-a93b-b331e2bde504', name: 'South Kensington' },
  sunbury:          { siteId: 'd9a25f51-2fb0-4d60-a968-63a6b0e76c51', name: 'Sunbury-on-Thames' },
  walthamstow:      { siteId: 'f40e53e2-aea4-4cbf-8158-407a7a0d3001', name: 'Walthamstow' },
  walton:           { siteId: '678f8817-199c-411b-b1f2-599226751533', name: 'Walton-on-Thames' },
  white_city:       { siteId: '6faaf7a0-1769-4582-95e5-7248596f2a51', name: 'White City' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const appPassword = req.headers['x-app-password'];
  if (!appPassword || appPassword !== process.env.APP_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  const { site } = req.body || {};
  if (!site) return res.status(400).json({ error: 'Missing site parameter' });
  const cfg = SITES[site];
  if (!cfg) return res.status(400).json({ error: 'Unknown site: ' + site });
  const token = process.env.FAMLY_TOKEN;
  if (!token) return res.status(500).json({ error: 'FAMLY_TOKEN not configured' });
  const query = '{childrenList(siteId:"' + cfg.siteId + '"){children{id name{fullName}birthday group{id title}}}}';
  const authHeaders = [
    { 'X-Famly-AccessToken': token },
    { 'X-Famly-Logintoken': token },
    { 'Authorization': 'Bearer ' + token },
  ];
  let lastError = null;
  for (const authHeader of authHeaders) {
    try {
      const response = await fetch('https://app.kinderzimmer.co.uk/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) {
        const txt = await response.text();
        lastError = 'HTTP ' + response.status + ' ' + JSON.stringify(authHeader) + ': ' + txt.slice(0,200);
        continue;
      }
      const data = await response.json();
      if (data.errors) {
        const msg = data.errors[0]?.message || 'GraphQL error';
        if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('not authorized')) {
          lastError = 'Auth error ' + JSON.stringify(authHeader) + ': ' + msg;
          continue;
        }
        return res.status(400).json({ error: msg, debug_header: Object.keys(authHeader)[0], debug_errors: data.errors });
      }
      return res.status(200).json({ ...data, _auth_header_used: Object.keys(authHeader)[0] });
    } catch (err) {
      lastError = 'Fetch error ' + JSON.stringify(authHeader) + ': ' + err.message;
    }
  }
  return res.status(401).json({ error: 'All auth headers failed', debug: lastError });
}
