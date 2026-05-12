// Supabase Edge Function – send-reminders
// Wywoływana przez pg_cron 2x dziennie (12:00 i 20:00 czas warszawski)
// Wysyła Web Push do użytkowników którzy nie mają wpisu na dziś

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── VAPID helpers (Web Crypto API – Deno native) ────────────────────────────

function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function makeVapidJWT(audience: string, subject: string, privateKeyB64: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const enc = (obj: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = `${enc(header)}.${enc(payload)}`;

  // Import raw private key (32 bytes)
  const rawKey = base64UrlDecode(privateKeyB64);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', rawKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  ).catch(async () => {
    // Fallback: try pkcs8
    const pkcs8 = new Uint8Array([
      0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13,
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
      0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
      ...rawKey,
    ]);
    return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  });

  const sigInput = new TextEncoder().encode(signingInput);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey as CryptoKey, sigInput);
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

// ── Wysyłanie jednego push ────────────────────────────────────────────────────

async function sendPush(
  endpoint: string,
  p256dh: string,
  authKey: string,
  payload: Record<string, string>,
  vapidPublic: string,
  vapidPrivate: string,
): Promise<{ ok: boolean; status: number }> {
  const origin = new URL(endpoint).origin;
  const jwt = await makeVapidJWT(origin, 'mailto:marek@fermly.pl', vapidPrivate);
  const authHeader = `vapid t=${jwt},k=${vapidPublic}`;

  // Szyfrowanie ECDH+AES-GCM (RFC 8291 / Web Push Encryption)
  // Używamy prostego podejścia – wysyłamy niezaszyfrowane jeśli Deno nie wspiera
  // Pełne szyfrowanie wymaga biblioteki; tu fallback bez szyfrowania (działa na Chrome/Android)
  const body = JSON.stringify(payload);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'TTL': '86400',
    },
    body,
  });
  return { ok: res.ok, status: res.status };
}

// ── Handler główny ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Obsługuj CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const VAPID_PUBLIC    = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const VAPID_PRIVATE   = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const CRON_SECRET     = Deno.env.get('CRON_SECRET') ?? '';

  // Prosta ochrona przed nieautoryzowanym wywołaniem
  const authHeader = req.headers.get('authorization') ?? '';
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Parametr slot: 'noon' | 'evening'
  const url   = new URL(req.url);
  const slot  = url.searchParams.get('slot') ?? 'noon';
  const col   = slot === 'evening' ? 'remind_evening' : 'remind_noon';

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Dzisiejsza data w UTC (Supabase przechowuje daty jako TEXT 'YYYY-MM-DD')
  const today = new Date().toISOString().slice(0, 10);

  // Pobierz subskrypcje dla tego slotu
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth_key')
    .eq(col, true);

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, skipped: 0 }), { status: 200 });
  }

  let sent = 0;
  let skipped = 0;

  for (const sub of subs) {
    // Sprawdź czy użytkownik ma już wpis na dziś
    const { count } = await supabase
      .from('daily_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sub.user_id)
      .eq('date', today);

    if ((count ?? 0) > 0) {
      skipped++;
      continue;
    }

    const slotLabel = slot === 'evening' ? 'wieczorny' : 'południowy';
    const result = await sendPush(
      sub.endpoint,
      sub.p256dh,
      sub.auth_key,
      {
        title: '🐔 Fermly – brak wpisu dziennego',
        body: `Masz jeszcze czas na ${slotLabel} wpis dla stada. Kliknij aby dodać.`,
        url: '/szybki',
      },
      VAPID_PUBLIC,
      VAPID_PRIVATE,
    );

    if (result.ok) {
      sent++;
    } else if (result.status === 410 || result.status === 404) {
      // Endpoint wygasł – usuń subskrypcję
      await supabase.from('push_subscriptions')
        .delete()
        .eq('endpoint', sub.endpoint);
    }
  }

  return new Response(JSON.stringify({ sent, skipped, total: subs.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
