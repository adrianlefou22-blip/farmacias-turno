const fetch = require('node-fetch');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 's-maxage=3600, stale-while-revalidate'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const kvUrl   = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    if (!kvUrl || !kvToken) return { statusCode: 500, headers, body: JSON.stringify({ error: 'KV no configurado' }) };

    // Upstash Redis REST API — GET key
    const kvRes = await fetch(`${kvUrl}/get/farmacias_data`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${kvToken}` }
    });

    if (!kvRes.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error leyendo KV' }) };

    const json = await kvRes.json();
    if (!json.result) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Sin datos aun' }) };

    // El resultado viene como string, lo devolvemos directo
    return { statusCode: 200, headers, body: json.result };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
