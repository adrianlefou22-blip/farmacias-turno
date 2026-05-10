const fetch = require('node-fetch');

const FARMACIAS_BASE = {
  tortuguitas: {
    'Tortuguitas': [
      { name:'Wassermann', address:'Directorio 507',       tel:'02320491321', shift:'A' },
      { name:'Riccardi',   address:'Francisco Segui 4073', tel:'02320492158', shift:'B' }
    ]
  },
  polvorines: {
    'Los Polvorines': [
      { name:'Dietrich',       address:'Ruta 8 y 197',             tel:'02320423259', shift:'A' },
      { name:'Rivadavia 2690', address:'Rivadavia 2681',           tel:'46638292',    shift:'B' },
      { name:'Ocampo',         address:'Pdte. Peron 3387',         tel:'46604575',    shift:'C' },
      { name:'J.R.',           address:'Arturo Illia 5254',        tel:'44516500',    shift:'C' },
      { name:'Emeric SCS',     address:'Baroni 1859',              tel:'46636212',    shift:'D' },
      { name:'Del Circulo',    address:'Pdte. Peron y Wilson',     tel:'46605111',    shift:'E' },
      { name:'Del Aguila',     address:'San Martin 2580',          tel:'46600303',    shift:'E' },
      { name:'Buffarini',      address:'Pdte. Peron 3030',         tel:'40074928',    shift:'F' },
      { name:'Botica',         address:'Rivadavia 2017',           tel:'42066206',    shift:'G' },
      { name:'Saos',           address:'L. Suarez 2939',           tel:'52923851',    shift:'H' },
      { name:'Borrino',        address:'Ing. Huergo 3595',         tel:'46604301',    shift:'I' },
      { name:'Phanamerican',   address:'R. 197 No 2044',           tel:'54363927',    shift:'J' }
    ],
    'Villa de Mayo': [
      { name:'Alvarez',        address:'Sucre 2359',               tel:'46600418',    shift:'A' },
      { name:'Rujana',         address:'Arquimides y Lujan',       tel:'46637405',    shift:'B' },
      { name:'L.A.I.',         address:'Av. Pdte. Peron 43',       tel:'1162980279',  shift:'B' },
      { name:'Sucre',          address:'Sucre 1635',               tel:'1141606909',  shift:'D' },
      { name:'Gintyla',        address:'S. Martin y Amenabar',     tel:'01146600002', shift:'F' },
      { name:'Medina',         address:'Av. Eva Peron 5068',       tel:'46636764',    shift:'H' },
      { name:'Eberbach',       address:'Av. Peron 897',            tel:'44638179',    shift:'J' }
    ],
    'Adolfo Sourdeaux': [
      { name:'Alvarez',        address:'Rosario 4605 esq. Derqui', tel:'47480415',    shift:'G' },
      { name:'Del Sol',        address:'Derqui y Pena',            tel:'47480679',    shift:'I' }
    ]
  },
  grandbourg: {
    'Grand Bourg': [
      { name:'Cernetti',            address:'Pasco 612',                    tel:'02320481327', shift:'A' },
      { name:'El Callao 24',        address:'El Callao 24',                 tel:'02320685470', shift:'B' },
      { name:'Cientifica Malvinas', address:'R.197 No 663',                 tel:'02320446021', shift:'C' },
      { name:'Raspo',               address:'Av. Grand Bourg 1098',         tel:'02320414834', shift:'D' },
      { name:'Ota',                 address:'Av. Grand Bourg 1301',         tel:'02320480531', shift:'E' },
      { name:'Rivera',              address:'Coronel Bogado 1626',          tel:'02320480261', shift:'F' },
      { name:'Sias',                address:'Cura Brochero 1669',           tel:'02320484070', shift:'G' },
      { name:'Laguzzi',             address:'Francisco Segui 1455',         tel:'02320480292', shift:'H' },
      { name:'Amoriello',           address:'El Callao 636',                tel:'01128750966', shift:'I' }
    ],
    'Ing. Pablo Nogues': [
      { name:'Nogues S.C.S.', address:'Miraflores 4799 y Mario Bravo',     tel:'02320683981', shift:'J' },
      { name:'Nogues Norte',  address:'Ejercito de los Andes 2224',        tel:'',            shift:'K' },
      { name:'Zona Sana',     address:'Ejercito de los Andes 2680',        tel:'',            shift:'L' }
    ]
  }
};

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const auth   = (event.headers['authorization'] || '').replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_SECRET;
  if (!secret || auth !== secret) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Contrasena incorrecta' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { calendars, month, year } = body;
    if (!calendars || !month || !year) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos' }) };
    }

    const payload = JSON.stringify({
      month: month - 1,
      year,
      updatedAt: new Date().toISOString(),
      source: 'admin',
      calendars,
      localities: FARMACIAS_BASE
    });

    const kvUrl   = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    if (!kvUrl || !kvToken) throw new Error('KV no configurado');

    // Upstash Redis REST API — SET key value
    const encoded = encodeURIComponent(payload);
    const kvRes = await fetch(`${kvUrl}/set/farmacias_data/${encoded}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${kvToken}` }
    });

    if (!kvRes.ok) {
      const errText = await kvRes.text();
      throw new Error(`KV error: ${errText}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, month, year, updatedAt: new Date().toISOString() })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
