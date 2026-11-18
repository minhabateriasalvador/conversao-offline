import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const ghlApiKey = process.env.GHL_API_KEY;
  const ghlLocationId = process.env.GHL_LOCATION_ID || 'b7oDv7GlDzLKQQiLqvMD';

  if (!ghlApiKey) {
    return res.status(500).json({ error: 'GHL_API_KEY ausente' });
  }

  try {
    const resp = await fetch(`https://services.leadconnectorhq.com/locations/${ghlLocationId}/customFields`, {
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    });

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
