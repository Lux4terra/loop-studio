// Loop Studio · small helpers shared by the core and every module.
import crypto from "node:crypto";

export function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}
export function body(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") { try { return JSON.parse(b); } catch (_) { return {}; } }
  return b;
}
// one line of text: no control characters or angle brackets, spaces collapsed, cut to n
export const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
// a paragraph: keeps line breaks, at most one blank line in a row
export const para = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0009\u000b-\u001f<>]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const fail = (http, message) => Object.assign(new Error(message), { http });
export const rid = (p, n = 4) => p + crypto.randomBytes(n).toString("hex");
export const now = () => new Date().toISOString();
export const copyOf = x => typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x));
