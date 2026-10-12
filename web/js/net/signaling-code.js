// Serverless WebRTC handshake ("manual signalling").
//
// The two players swap a single text code out of band - chat, mail, a sticky
// note - so no signalling server, account or build step is involved, and the
// page works from a static host or even file://. The code is the ICE-complete
// SDP, base64url-encoded:
//
//     host : createOffer()            -> code  (send to the guest)
//     guest: joinWith(hostCode)       -> code  (send back to the host)
//     host : accept(guestCode)        -> data channel opens
//
// STUN only helps discover a public address; two players on the same LAN
// connect without it.
const TAG = 'ctg1';

function bytesToB64url(bytes) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(code) {
  const s = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

async function pump(stream, chunk) {
  const writer = stream.writable.getWriter();
  writer.write(chunk);
  writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** SDP -> portable copy/pasteable code. Avoid CompressionStream format gaps on phones. */
export async function encodeCode(desc) {
  const json = JSON.stringify({ v: 1, k: desc.type, s: desc.sdp });
  const raw = new TextEncoder().encode(json);
  return `${TAG}.${bytesToB64url(raw)}`;
}

/** code -> { type, sdp } */
export async function decodeCode(code) {
  const text = String(code || '').trim().replace(/\s+/g, '');
  const dot = text.indexOf('.');
  if (dot < 0) throw new Error('that does not look like a code');
  const tag = text.slice(0, dot);
  const body = text.slice(dot + 1);
  if (tag !== TAG && tag !== `${TAG}d`) throw new Error('unknown code version');
  let bytes = b64urlToBytes(body);
  if (tag === `${TAG}d`) {
    if (typeof DecompressionStream !== 'function') throw new Error('this browser cannot read that code');
    bytes = await pump(new DecompressionStream('deflate-raw'), bytes);
  }
  const payload = JSON.parse(new TextDecoder().decode(bytes));
  if (payload.v !== 1 || typeof payload.s !== 'string') throw new Error('malformed code');
  return { type: payload.k, sdp: payload.s };
}

