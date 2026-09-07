const KEY = 'code-qube-live-link';
const TTL = 180;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

function store(env) {
  return env.LIVE_LINKS;
}

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestGet({ env }) {
  const kv = store(env);
  if (!kv) return json({ error: 'Live-link storage is not configured.' }, 503);

  const item = await kv.get(KEY, { type: 'json' });
  if (!item?.url || !item?.expiresAt || item.expiresAt <= Date.now()) {
    if (item) await kv.delete(KEY);
    return json({ active: false });
  }

  return json({ active: true, url: item.url, expiresAt: item.expiresAt });
}

export async function onRequestPost({ request, env }) {
  const kv = store(env);
  if (!kv) return json({ error: 'Live-link storage is not configured.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const raw = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!raw || raw.length > 2048) return json({ error: 'Enter a valid URL.' }, 400);

  let url;
  try {
    url = new URL(raw);
  } catch {
    return json({ error: 'Enter a valid URL.' }, 400);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return json({ error: 'Only http and https links are allowed.' }, 400);
  }

  const expiresAt = Date.now() + TTL * 1000;
  const item = { url: url.href, expiresAt };
  await kv.put(KEY, JSON.stringify(item), { expirationTtl: TTL });

  return json({ active: true, url: item.url, expiresAt: item.expiresAt }, 201);
}

export async function onRequestDelete({ env }) {
  const kv = store(env);
  if (!kv) return json({ error: 'Live-link storage is not configured.' }, 503);
  await kv.delete(KEY);
  return json({ active: false });
}
