// Loop Studio · the free-model router. One place where Studio asks a model for a draft: Gemini first and Groq as
// fallback, or one of them alone, as the person chooses. Keys come from Vercel's environment only. Every draft is
// checked whole before it is shown, one time budget covers the chain, and names, emails, phone numbers and handles
// are taken out before anything leaves. A draft is always prepared for a person: nothing here saves or sends.

export const PROVIDERS = ["gemini", "groq"];
export const KEYS = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY" };
export const ORDERS = ["auto", "gemini", "groq"];

const escRx = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The words of a name worth keeping out: the whole name and each part of three letters or more.
export function nameParts(list) {
  const out = new Set();
  for (const n of list || []) {
    const s = String(n || "").trim(); if (s.length < 2) continue;
    out.add(s);
    for (const w of s.split(/[\s,]+/)) if (w.replace(/[^\p{L}]/gu, "").length >= 3) out.add(w.replace(/[.,]+$/, ""));
  }
  return [...out].sort((a, b) => b.length - a.length);
}

// Takes out emails, handles, phone numbers and the names given; says how many it took out.
export function scrub(text, names) {
  let s = String(text == null ? "" : text), n = 0;
  const sub = (rx, rep, keep) => { s = s.replace(rx, m => { if (keep && keep(m)) return m; n++; return rep; }); };
  sub(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]");
  sub(/(?<![\w@])@[A-Za-z0-9_]{2,}/g, "[handle]");
  // nine digits or more in a run of digits, spaces and dashes; dates and versions stay
  sub(/\+?\d[\d\s().-]{7,}\d/g, "[phone]", m => (m.match(/\d/g) || []).length < 9 || /^\d{4}-\d{2}-\d{2}$/.test(m.trim()));
  for (const w of nameParts(names)) sub(new RegExp("(?<![\\p{L}\\p{N}])" + escRx(w) + "(?![\\p{L}\\p{N}])", "giu"), "[person]");
  return { text: s, removed: n };
}

export function makeModels(E) {
  const key = p => String(E[KEYS[p]] || "").trim();
  const keys = () => ({ gemini: !!key("gemini"), groq: !!key("groq") });
  const list = (v, d) => String(v || d).split(",").map(x => x.trim()).filter(Boolean);
  const MODELS = {
    gemini: () => list(E.GEMINI_MODELS, "gemini-2.5-flash,gemini-flash-latest"),
    groq: () => list(E.GROQ_MODELS, "llama-3.3-70b-versatile,openai/gpt-oss-120b")
  };
  const within = ms => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; };

  // One model, one try: its text, and whether it says it finished.
  async function once(p, model, sys, prompt, max, ms) {
    const w = within(ms);
    try {
      if (p === "gemini") {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST", signal: w.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": key("gemini") },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: max, ...(/2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } }) });
        if (!r.ok) return null;
        const j = await r.json(), c = (j.candidates || [])[0] || {};
        return { text: ((c.content || {}).parts || []).filter(x => !x.thought).map(x => x.text || "").join("").trim(), done: !c.finishReason || c.finishReason === "STOP" };
      }
      if (p === "groq") {
        const reasoning = /gpt-oss|qwen3|deepseek-r/i.test(model);
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", signal: w.signal, headers: { "Content-Type": "application/json", Authorization: "Bearer " + key("groq") },
          body: JSON.stringify({ model, temperature: 0.4, max_tokens: max + (reasoning ? 600 : 0), messages: [{ role: "system", content: sys }, { role: "user", content: prompt }], ...(reasoning ? { reasoning_effort: "low" } : {}) }) });
        if (!r.ok) return null;
        const j = await r.json(), c = (j.choices || [])[0] || {};
        return { text: String((c.message || {}).content || "").trim(), done: c.finish_reason === "stop" || c.finish_reason == null };
      }
    } catch (_) { return null; } finally { w.done(); }
    return null;
  }

  // The chain: the providers chosen and keyed, each model in turn, within one budget.
  // Returns { ok, text, via, model, removed } or { ok: false, missing } (no key) or { ok: false, busy } (every model failed).
  async function draft(o) {
    const want = o.order === "gemini" ? ["gemini"] : o.order === "groq" ? ["groq"] : PROVIDERS;
    const have = keys(), chain = want.filter(p => have[p]);
    if (!chain.length) return { ok: false, missing: want.map(p => KEYS[p]) };
    const P = scrub(o.prompt, o.names), S = scrub(o.sys, o.names), max = o.max || 1400;
    const end = Date.now() + (o.budget || 22000), tried = [];
    for (const p of chain) for (const model of MODELS[p]()) {
      for (let i = 0; i < 2; i++) {
        const left = end - Date.now(); if (left < 1500) return { ok: false, busy: true, tried, removed: P.removed };
        const raw = await once(p, model, S.text, P.text, max * (i + 1), Math.min(left - 300, 15000));
        tried.push(p + ":" + model + ":" + (!raw ? "failed" : raw.done ? "done" : "cut"));
        const v = raw && raw.done && raw.text ? (o.check ? o.check(raw.text) : raw.text) : null;
        if (v) return { ok: true, text: v, via: p, model, removed: P.removed, tried };
        if (!(raw && raw.text && !raw.done)) break; // stopped early: one more try with more room, else the next model
      }
    }
    return { ok: false, busy: true, tried, removed: P.removed };
  }
  return { keys, draft, scrub, KEYS, ORDERS };
}
