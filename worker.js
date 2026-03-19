const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle /api/waitlist
    if (url.pathname === '/api/waitlist') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const { name, email, wearables, goals, appCount, timestamp } = body;

          if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Name and valid email are required.' }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          const kv = env.WAITLIST;
          if (kv) {
            const existing = await kv.get(email);
            if (existing) {
              return new Response(JSON.stringify({ message: "You're already on the list." }), {
                status: 200,
                headers: corsHeaders,
              });
            }
            await kv.put(email, JSON.stringify({
              name,
              email,
              wearables: Array.isArray(wearables) ? wearables : [],
              goals: Array.isArray(goals) ? goals : [],
              appCount: appCount || '',
              joined: timestamp || new Date().toISOString(),
              source: 'website',
            }));
          }

          return new Response(JSON.stringify({ message: 'success' }), {
            status: 200,
            headers: corsHeaders,
          });
        } catch {
          return new Response(JSON.stringify({ error: 'Something went wrong. Try again.' }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }
    }

    // For all other requests, pass through to static assets
    return env.ASSETS.fetch(request);
  },
};
