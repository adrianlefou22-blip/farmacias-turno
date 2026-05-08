// api/update.js
// Solo el admin puede llamar esto (protegido por ADMIN_SECRET)
// Descarga la web del municipio, extrae los turnos y los guarda en KV

const fetch = require('node-fetch');

// ── Farmacias base (nombre, dirección, teléfono, turno asignado) ──────────
// Estos datos son estables — solo cambian los calendarios cada mes
const FARMACIAS_BASE = {
  tortuguitas: {
    'Tortuguitas': [
      { name:'Wassermann', address:'Directorio 507',       tel:'02320491321', shift:'A' },
      { name:'Riccardi',   address:'Francisco Seguí 4073', tel:'02320492158', shift:'B' }
    ]
  },
  polvorines: {
    'Los Polvorines': [
      { name:'Dietrich',       address:'Ruta 8 y 197',             tel:'02320423259', shift:'A' },
      { name:'Rivadavia 2690', address:'Rivadavia 2681',           tel:'46638292',    shift:'B' },
      { name:'Ocampo',         address:'Pdte. Perón 3387',         tel:'46604575',    shift:'C' },
      { name:'J.R.',           address:'Arturo Illia 5254',        tel:'44516500',    shift:'C' },
      { name:'Emeric SCS',     address:'Baroni 1859',              tel:'46636212',    shift:'D' },
      { name:'Del Círculo',    address:'Pdte. Perón y Wilson',     tel:'46605111',    shift:'E' },
      { name:'Del Águila',     address:'San Martín 2580',          tel:'46600303',    shift:'E' },
      { name:'Buffarini',      address:'Pdte. Perón 3030',         tel:'40074928',    shift:'F' },
      { name:'Botica',         address:'Rivadavia 2017',           tel:'42066206',    shift:'G' },
      { name:'Saos',           address:'L. Suárez 2939',           tel:'52923851',    shift:'H' },
      { name:'Borrino',        address:'Ing. Huergo 3595',         tel:'46604301',    shift:'I' },
      { name:'Phanamerican',   address:'R. 197 Nº 2044',           tel:'54363927',    shift:'J' }
    ],
    'Villa de Mayo': [
      { name:'Álvarez',        address:'Sucre 2359',               tel:'46600418',    shift:'A' },
      { name:'Rujana',         address:'Arquímides y Luján',       tel:'46637405',    shift:'B' },
      { name:'L.A.I.',         address:'Av. Pdte. Perón 43',       tel:'1162980279',  shift:'B' },
      { name:'Sucre',          address:'Sucre 1635',               tel:'1141606909',  shift:'D' },
      { name:'Gintyla',        address:'S. Martín y Amenabar',     tel:'01146600002', shift:'F' },
      { name:'Medina',         address:'Av. Eva Perón 5068',       tel:'46636764',    shift:'H' },
      { name:'Eberbach',       address:'Av. Perón 897',            tel:'44638179',    shift:'J' }
    ],
    'Adolfo Sourdeaux': [
      { name:'Álvarez',        address:'Rosario 4605 esq. Derqui', tel:'47480415',    shift:'G' },
      { name:'Del Sol',        address:'Derqui y Peña',            tel:'47480679',    shift:'I' }
    ]
  },
  grandbourg: {
    'Grand Bourg': [
      { name:'Cernetti',            address:'Pasco 612',                    tel:'02320481327', shift:'A' },
      { name:'El Callao 24',        address:'El Callao 24',                 tel:'02320685470', shift:'B' },
      { name:'Científica Malvinas', address:'R.197 Nº 663',                 tel:'02320446021', shift:'C' },
      { name:'Raspo',               address:'Av. Grand Bourg 1098',         tel:'02320414834', shift:'D' },
      { name:'Ota',                 address:'Av. Grand Bourg 1301',         tel:'02320480531', shift:'E' },
      { name:'Rivera',              address:'Coronel Bogado 1626',          tel:'02320480261', shift:'F' },
      { name:'Sias',                address:'Cura Brochero 1669',           tel:'02320484070', shift:'G' },
      { name:'Laguzzi',             address:'Francisco Seguí 1455',         tel:'02320480292', shift:'H' },
      { name:'Amoriello',           address:'El Callao 636',                tel:'01128750966', shift:'I' }
    ],
    'Ing. Pablo Nogués': [
      { name:'Nogués S.C.S.', address:'Miraflores 4799 y Mario Bravo',     tel:'02320683981', shift:'J' },
      { name:'Nogués Norte',  address:'Ejército de los Andes 2224',        tel:'',            shift:'K' },
      { name:'Zona Sana',     address:'Ejército de los Andes 2680',        tel:'',            shift:'L' }
    ]
  }
};

// ── Parsear HTML del municipio ────────────────────────────────────────────
// La web muestra calendarios con letras por zona
// Buscamos patrones: día + letra en cada zona
function parseCalendars(html) {
  const calendars = { tortuguitas: [], polvorines: [], grandbourg: [] };

  // Buscar secciones por zona usando palabras clave del HTML
  // Extraemos todos los bloques de celdas de calendario con su letra asignada
  // Estrategia: buscar tablas/grillas con días del 1 al 31 y la letra correspondiente

  // Patrón general: número de día seguido de letra (A-L o combinaciones como E/J)
  // Ej: "01\nA" "09\nE/J" "24\nA/B"
  const dayLetterPattern = /\b(0?[1-9]|[12]\d|3[01])\b[\s\S]{0,30}?\b([A-L](?:\/[A-L])?)\b/g;

  // Dividir HTML en secciones por zona
  const zones = [
    { key: 'tortuguitas', keywords: ['TORTUGUITAS'] },
    { key: 'polvorines',  keywords: ['POLVORINES', 'VILLA DE MAYO', 'SOURDEAUX'] },
    { key: 'grandbourg',  keywords: ['GRAND BOURG', 'NOGUÉS', 'NOGUES'] }
  ];

  // Intentar extraer sección por zona
  const htmlUpper = html.toUpperCase();

  zones.forEach(zone => {
    // Encontrar inicio de sección
    let startIdx = -1;
    zone.keywords.forEach(kw => {
      const idx = htmlUpper.indexOf(kw);
      if (idx !== -1 && (startIdx === -1 || idx < startIdx)) startIdx = idx;
    });

    if (startIdx === -1) return;

    // Tomar chunk de ~15000 chars desde esa sección
    const chunk = html.substring(startIdx, startIdx + 15000);

    // Extraer pares día→letra
    const dayMap = {};
    let m;
    const re = /\b(0?[1-9]|[12]\d|3[01])\b[\s\S]{0,50}?\b([A-L](?:\/[A-L])?)\b/g;
    while ((m = re.exec(chunk)) !== null) {
      const day = parseInt(m[1]);
      const letter = m[2];
      if (day >= 1 && day <= 31 && !dayMap[day]) {
        dayMap[day] = letter;
      }
    }

    // Construir array de 31 días
    const cal = [];
    for (let d = 1; d <= 31; d++) {
      cal.push(dayMap[d] || null);
    }

    // Validar que tenga suficientes datos (al menos 20 días con letra)
    const filled = cal.filter(Boolean).length;
    if (filled >= 20) {
      calendars[zone.key] = cal;
    }
  });

  return calendars;
}

// ── Handler principal ─────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verificar secret de admin
  const auth = req.headers['authorization'] || '';
  const secret = process.env.ADMIN_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    console.log('Descargando web del municipio...');
    const response = await fetch('https://www.malvinasargentinas.gob.ar/farmaciasturno', {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FarmaciasBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9'
      },
      timeout: 20000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al acceder a la web`);
    }

    const html = await response.text();
    console.log(`HTML descargado: ${html.length} chars`);

    // Parsear calendarios
    const calendars = parseCalendars(html);

    // Detectar mes y año actuales
    const now = new Date();
    const month = now.getMonth();
    const year  = now.getFullYear();

    // Validar que al menos una zona tenga datos
    const hasData = Object.values(calendars).some(c => c.filter(Boolean).length >= 20);

    // Si el parseo falló, usar calendarios del mes actual hardcodeados como fallback
    // (los del ZIP original — Mayo 2026)
    let finalCalendars = calendars;
    let source = 'web';

    if (!hasData) {
      console.log('Parseo falló, usando datos de respaldo...');
      finalCalendars = {
        tortuguitas: ['A','B','B','A','A','B','A','B','A','A','B','B','A','B','A','B','B','A','A','B','B','A','A','B','B','A','B','A','B','A','A'],
        polvorines:  ['D','E','F','G','H','I','J','A','B','C','D','E','F','G','H','I','J','A','B','C','D','E','F','G','H','I','J','A','B','C','D'],
        grandbourg:  ['C','D','E','F','G','A','C','D','E/J','F','I','B','C','D','E','F/K','G/I','A','C','D','E','F','G/I','A/B','C','D','E','F','G','A/B','C']
      };
      source = 'fallback';
    }

    // Armar payload completo
    const payload = {
      month,
      year,
      updatedAt: new Date().toISOString(),
      source,
      calendars: finalCalendars,
      localities: FARMACIAS_BASE
    };

    // Guardar en Vercel KV
    const kvUrl   = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
      throw new Error('KV no configurado — falta KV_REST_API_URL o KV_REST_API_TOKEN');
    }

    const kvRes = await fetch(`${kvUrl}/set/farmacias_data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kvToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: JSON.stringify(payload) })
    });

    if (!kvRes.ok) {
      const err = await kvRes.text();
      throw new Error(`KV error: ${err}`);
    }

    console.log(`✓ Datos guardados en KV — fuente: ${source}`);
    return res.status(200).json({
      ok: true,
      source,
      month: month + 1,
      year,
      updatedAt: payload.updatedAt,
      zones: Object.fromEntries(
        Object.entries(finalCalendars).map(([k, v]) => [k, v.filter(Boolean).length + ' días'])
      )
    });

  } catch (err) {
    console.error('Error en update:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
