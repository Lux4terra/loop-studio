/* the theme and text size apply before anything is drawn, so nothing flashes */
try { const s = JSON.parse(localStorage.getItem("loop_studio") || "{}"), d = document.documentElement;
  if (s.theme && s.theme !== "auto") d.dataset.theme = s.theme;
  if (s.fs && s.fs !== "m") d.dataset.fs = s.fs;
  if (s.accent) d.style.setProperty("--accent", s.accent); } catch (_) {}
