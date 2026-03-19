export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const body = await context.request.json();
    const { name, email, wearables, goals, appCount, timestamp } = body;

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Name and valid email are required.' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Google Sheets API via service account
    const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID } = context.env;

    if (GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY && GOOGLE_SHEET_ID) {
      const token = await getAccessToken(GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY);

      const row = [
        timestamp || new Date().toISOString(),
        name,
        email,
        Array.isArray(wearables) ? wearables.join(', ') : '',
        Array.isArray(goals) ? goals.join(', ') : '',
        appCount || '',
      ];

      await appendToSheet(token, GOOGLE_SHEET_ID, row);
    }

    return new Response(JSON.stringify({ message: 'success' }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error('Waitlist error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Try again.' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// --- Google Sheets helpers ---

async function getAccessToken(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const key = await importPrivateKey(privateKeyPem);
  const jwt = await signJwt(header, payload, key);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function appendToSheet(token, sheetId, row) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Sheets API error: ' + err);
  }
}

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .replace(/\s/g, '');

  const binaryStr = atob(pemContents);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function signJwt(header, payload, key) {
  const enc = new TextEncoder();
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    enc.encode(signingInput)
  );

  return `${signingInput}.${base64url(signature)}`;
}

function base64url(input) {
  let str;
  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
