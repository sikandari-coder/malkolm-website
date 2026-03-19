export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const { email } = await context.request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Store in Cloudflare KV (bind a KV namespace called WAITLIST in Pages settings)
    const kv = context.env.WAITLIST;
    if (kv) {
      const existing = await kv.get(email);
      if (existing) {
        return new Response(JSON.stringify({ message: "You're already on the list." }), {
          status: 200,
          headers: corsHeaders,
        });
      }
      await kv.put(email, JSON.stringify({
        email,
        joined: new Date().toISOString(),
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
