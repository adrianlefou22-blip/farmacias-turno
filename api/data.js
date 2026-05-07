// api/data.js
// Endpoint público — devuelve los datos del mes guardados en KV
// La app lo llama al abrir para tener siempre datos frescos

const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Cache 1 hora en CDN de Vercel
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  try {
    const kvUrl   = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
      return res.status(500).json({ error: 'KV no configurado' });
    }

    const kvRes = await fetch(`${kvUrl}/get/farmacias_data`, {
      headers: { 'Authorization': `Bearer ${kvToken}` }
    });

    if (!kvRes.ok) {
      return res.status(500).json({ error: 'Error leyendo KV' });
    }

    const json = await kvRes.json();

    if (!json.result) {
      return res.status(404).json({ error: 'Sin datos — el admin aún no actualizó' });
    }

    const data = JSON.parse(json.result);
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
