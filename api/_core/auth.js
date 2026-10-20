// Loop Studio · sign-in. One person, the admin. STUDIO_KEY (a Vercel variable, never written anywhere else) does two
// jobs: it signs every session, so rotating it signs every device out; and it sets up or resets the account, as
// a recovery key would. Day to day the person signs in with their own passcode, kept only as a salted hash.
import crypto from "node:crypto";

export const TOKEN_DAYS = 60;
export const KEY_MIN = 16;

export function makeAuth(E) {
  const KEY = () => String(E.STUDIO_KEY || "").trim();
  const ready = () => KEY().length >= KEY_MIN;
  const b64u = s => Buffer.from(s).toString("base64url");
  const mac = p => crypto.createHmac("sha256", KEY() + "|loop-studio").update(p).digest("base64url");
  const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

  function token(acc) {
    const p = b64u(JSON.stringify({ k: "studio", v: acc.pv, e: Date.now() + TOKEN_DAYS * 864e5 }));
    return p + "." + mac(p);
  }
  // the token's claims when its signature holds and it has not expired; the caller checks the passcode version
  function verify(req) {
    const t = String((req.headers && req.headers.authorization) || "").replace(/^Bearer\s+/i, "").trim();
    const [p, s] = t.split(".");
    if (!p || !s || !ready() || !same(mac(p), s)) return null;
    let o; try { o = JSON.parse(Buffer.from(p, "base64url").toString("utf8")); } catch (_) { return null; }
    return o && o.k === "studio" && o.e > Date.now() ? o : null;
  }
  // the setup key, compared in constant time
  function keyOk(k) {
    if (!ready()) return false;
    const x = crypto.createHash("sha256").update(String(k || "")).digest(), y = crypto.createHash("sha256").update(KEY()).digest();
    return crypto.timingSafeEqual(x, y);
  }
  const hash = (pass, salt) => crypto.scryptSync(String(pass), salt, 32).toString("hex");
  function seal(pass) { const s = crypto.randomBytes(16).toString("hex"); return { s, h: hash(pass, s) }; }
  function passOk(acc, pass) { return !!(acc && acc.ph && acc.ph.s && same(hash(pass, acc.ph.s), acc.ph.h)); }
  function weak(p) {
    p = String(p || "");
    if (p.length < 8) return "Use at least 8 characters.";
    if (p.length > 72) return "Use 72 characters or fewer.";
    if (/^(.)\1+$/.test(p) || "01234567890123456789".includes(p) || "98765432109876543210".includes(p) || /^(password|passcode|studio)\d*$/i.test(p)) return "Too easy to guess. Choose something longer or less regular.";
    return "";
  }
  // tries per warm instance; with the pause after each miss, guessing an 8+ character passcode is impractical
  const tries = new Map();
  const tooMany = k => { const t = tries.get(k); return !!t && t.n >= 6 && Date.now() - t.at < 15 * 60e3; };
  const miss = k => { const t = tries.get(k); tries.set(k, t && Date.now() - t.at < 15 * 60e3 ? { n: t.n + 1, at: t.at } : { n: 1, at: Date.now() }); };
  const clear = k => tries.delete(k);
  return { ready, token, verify, keyOk, seal, passOk, weak, tooMany, miss, clear };
}
