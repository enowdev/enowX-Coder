/**
 * Design system CSS injected into every html:preview iframe.
 * Theme is controlled by a class on <html>: .dark or .light.
 * This is set by the host app based on its theme state, NOT by OS prefers-color-scheme.
 */

export const PREVIEW_DESIGN_SYSTEM = `
/* ── CSS Variables (dark mode default) ─────────────────────────────── */
:root, .dark {
  --p: #e0e0e0;
  --s: #a0a0a0;
  --t: #707070;
  --bg2: #2a2a2a;
  --b: #404040;
  --color-text-primary: #e0e0e0;
  --color-text-secondary: #a0a0a0;
  --color-text-tertiary: #707070;
  --color-text-info: #85B7EB;
  --color-text-danger: #F09595;
  --color-text-success: #97C459;
  --color-text-warning: #EF9F27;
  --color-background-primary: #1a1a1a;
  --color-background-secondary: #2a2a2a;
  --color-background-tertiary: #111111;
  --color-background-info: #0C447C;
  --color-background-danger: #791F1F;
  --color-background-success: #27500A;
  --color-background-warning: #633806;
  --color-border-primary: rgba(255,255,255,0.4);
  --color-border-secondary: rgba(255,255,255,0.3);
  --color-border-tertiary: rgba(255,255,255,0.15);
  --color-border-info: #85B7EB;
  --color-border-danger: #F09595;
  --color-border-success: #97C459;
  --color-border-warning: #EF9F27;
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: ui-monospace, monospace;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --border-radius-xl: 16px;
}

/* ── Light mode overrides (class-based, not media query) ───────────── */
.light {
  --p: #1a1a1a;
  --s: #555555;
  --t: #888888;
  --bg2: #f5f5f0;
  --b: #d8d5cc;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #555555;
  --color-text-tertiary: #888888;
  --color-text-info: #185FA5;
  --color-text-danger: #A32D2D;
  --color-text-success: #3B6D11;
  --color-text-warning: #854F0B;
  --color-background-primary: #ffffff;
  --color-background-secondary: #f5f5f0;
  --color-background-tertiary: #eaeae4;
  --color-background-info: #E6F1FB;
  --color-background-danger: #FCEBEB;
  --color-background-success: #EAF3DE;
  --color-background-warning: #FAEEDA;
  --color-border-primary: rgba(0,0,0,0.4);
  --color-border-secondary: rgba(0,0,0,0.2);
  --color-border-tertiary: rgba(0,0,0,0.1);
  --color-border-info: #378ADD;
  --color-border-danger: #E24B4A;
  --color-border-success: #639922;
  --color-border-warning: #BA7517;
}

/* ── Base styles ───────────────────────────────────────────────────── */
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 1rem;
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.7;
  color: var(--color-text-primary);
  background: transparent;
  -webkit-font-smoothing: antialiased;
}
h1 { font-size: 22px; font-weight: 500; margin: 0 0 12px; }
h2 { font-size: 18px; font-weight: 500; margin: 0 0 10px; }
h3 { font-size: 16px; font-weight: 500; margin: 0 0 8px; }

/* ── SVG text classes ──────────────────────────────────────────────── */
svg .t  { font-family: var(--font-sans); font-size: 14px; fill: var(--p); }
svg .ts { font-family: var(--font-sans); font-size: 12px; fill: var(--s); }
svg .th { font-family: var(--font-sans); font-size: 14px; font-weight: 500; fill: var(--p); }

/* ── SVG shape classes ─────────────────────────────────────────────── */
svg .box { fill: var(--bg2); stroke: var(--b); }
svg .node { cursor: pointer; transition: opacity 0.15s; }
svg .node:hover { opacity: 0.8; }
svg .arr { stroke: var(--t); stroke-width: 1.5; fill: none; }
svg .leader { stroke: var(--t); stroke-width: 0.5; stroke-dasharray: 4 3; fill: none; }

/* ── SVG Color Ramp Classes (dark mode default) ────────────────────── */
svg .c-purple > rect, svg .c-purple > circle, svg .c-purple > ellipse { fill: #3C3489; stroke: #AFA9EC; stroke-width: 0.5; }
svg .c-purple > .th, svg .c-purple > .t { fill: #CECBF6; }
svg .c-purple > .ts { fill: #AFA9EC; }
svg rect.c-purple, svg circle.c-purple, svg ellipse.c-purple { fill: #3C3489; stroke: #AFA9EC; }

svg .c-teal > rect, svg .c-teal > circle, svg .c-teal > ellipse { fill: #085041; stroke: #5DCAA5; stroke-width: 0.5; }
svg .c-teal > .th, svg .c-teal > .t { fill: #9FE1CB; }
svg .c-teal > .ts { fill: #5DCAA5; }
svg rect.c-teal, svg circle.c-teal, svg ellipse.c-teal { fill: #085041; stroke: #5DCAA5; }

svg .c-coral > rect, svg .c-coral > circle, svg .c-coral > ellipse { fill: #712B13; stroke: #F0997B; stroke-width: 0.5; }
svg .c-coral > .th, svg .c-coral > .t { fill: #F5C4B3; }
svg .c-coral > .ts { fill: #F0997B; }
svg rect.c-coral, svg circle.c-coral, svg ellipse.c-coral { fill: #712B13; stroke: #F0997B; }

svg .c-pink > rect, svg .c-pink > circle, svg .c-pink > ellipse { fill: #72243E; stroke: #ED93B1; stroke-width: 0.5; }
svg .c-pink > .th, svg .c-pink > .t { fill: #F4C0D1; }
svg .c-pink > .ts { fill: #ED93B1; }
svg rect.c-pink, svg circle.c-pink, svg ellipse.c-pink { fill: #72243E; stroke: #ED93B1; }

svg .c-gray > rect, svg .c-gray > circle, svg .c-gray > ellipse { fill: #444441; stroke: #B4B2A9; stroke-width: 0.5; }
svg .c-gray > .th, svg .c-gray > .t { fill: #D3D1C7; }
svg .c-gray > .ts { fill: #B4B2A9; }
svg rect.c-gray, svg circle.c-gray, svg ellipse.c-gray { fill: #444441; stroke: #B4B2A9; }

svg .c-blue > rect, svg .c-blue > circle, svg .c-blue > ellipse { fill: #0C447C; stroke: #85B7EB; stroke-width: 0.5; }
svg .c-blue > .th, svg .c-blue > .t { fill: #B5D4F4; }
svg .c-blue > .ts { fill: #85B7EB; }
svg rect.c-blue, svg circle.c-blue, svg ellipse.c-blue { fill: #0C447C; stroke: #85B7EB; }

svg .c-green > rect, svg .c-green > circle, svg .c-green > ellipse { fill: #27500A; stroke: #97C459; stroke-width: 0.5; }
svg .c-green > .th, svg .c-green > .t { fill: #C0DD97; }
svg .c-green > .ts { fill: #97C459; }
svg rect.c-green, svg circle.c-green, svg ellipse.c-green { fill: #27500A; stroke: #97C459; }

svg .c-amber > rect, svg .c-amber > circle, svg .c-amber > ellipse { fill: #633806; stroke: #EF9F27; stroke-width: 0.5; }
svg .c-amber > .th, svg .c-amber > .t { fill: #FAC775; }
svg .c-amber > .ts { fill: #EF9F27; }
svg rect.c-amber, svg circle.c-amber, svg ellipse.c-amber { fill: #633806; stroke: #EF9F27; }

svg .c-red > rect, svg .c-red > circle, svg .c-red > ellipse { fill: #791F1F; stroke: #F09595; stroke-width: 0.5; }
svg .c-red > .th, svg .c-red > .t { fill: #F7C1C1; }
svg .c-red > .ts { fill: #F09595; }
svg rect.c-red, svg circle.c-red, svg ellipse.c-red { fill: #791F1F; stroke: #F09595; }

/* ── Light mode color ramps (class-based) ──────────────────────────── */
.light svg .c-purple > rect, .light svg .c-purple > circle, .light svg .c-purple > ellipse { fill: #EEEDFE; stroke: #7F77DD; }
.light svg .c-purple > .th, .light svg .c-purple > .t { fill: #3C3489; }
.light svg .c-purple > .ts { fill: #534AB7; }

.light svg .c-teal > rect, .light svg .c-teal > circle, .light svg .c-teal > ellipse { fill: #E1F5EE; stroke: #1D9E75; }
.light svg .c-teal > .th, .light svg .c-teal > .t { fill: #085041; }
.light svg .c-teal > .ts { fill: #0F6E56; }

.light svg .c-coral > rect, .light svg .c-coral > circle, .light svg .c-coral > ellipse { fill: #FAECE7; stroke: #D85A30; }
.light svg .c-coral > .th, .light svg .c-coral > .t { fill: #712B13; }
.light svg .c-coral > .ts { fill: #993C1D; }

.light svg .c-pink > rect, .light svg .c-pink > circle, .light svg .c-pink > ellipse { fill: #FBEAF0; stroke: #D4537E; }
.light svg .c-pink > .th, .light svg .c-pink > .t { fill: #72243E; }
.light svg .c-pink > .ts { fill: #993556; }

.light svg .c-gray > rect, .light svg .c-gray > circle, .light svg .c-gray > ellipse { fill: #F1EFE8; stroke: #888780; }
.light svg .c-gray > .th, .light svg .c-gray > .t { fill: #444441; }
.light svg .c-gray > .ts { fill: #5F5E5A; }

.light svg .c-blue > rect, .light svg .c-blue > circle, .light svg .c-blue > ellipse { fill: #E6F1FB; stroke: #378ADD; }
.light svg .c-blue > .th, .light svg .c-blue > .t { fill: #0C447C; }
.light svg .c-blue > .ts { fill: #185FA5; }

.light svg .c-green > rect, .light svg .c-green > circle, .light svg .c-green > ellipse { fill: #EAF3DE; stroke: #639922; }
.light svg .c-green > .th, .light svg .c-green > .t { fill: #27500A; }
.light svg .c-green > .ts { fill: #3B6D11; }

.light svg .c-amber > rect, .light svg .c-amber > circle, .light svg .c-amber > ellipse { fill: #FAEEDA; stroke: #BA7517; }
.light svg .c-amber > .th, .light svg .c-amber > .t { fill: #633806; }
.light svg .c-amber > .ts { fill: #854F0B; }

.light svg .c-red > rect, .light svg .c-red > circle, .light svg .c-red > ellipse { fill: #FCEBEB; stroke: #E24B4A; }
.light svg .c-red > .th, .light svg .c-red > .t { fill: #791F1F; }
.light svg .c-red > .ts { fill: #A32D2D; }

.light svg rect.c-purple, .light svg circle.c-purple, .light svg ellipse.c-purple { fill: #EEEDFE; stroke: #7F77DD; }
.light svg rect.c-teal, .light svg circle.c-teal, .light svg ellipse.c-teal { fill: #E1F5EE; stroke: #1D9E75; }
.light svg rect.c-coral, .light svg circle.c-coral, .light svg ellipse.c-coral { fill: #FAECE7; stroke: #D85A30; }
.light svg rect.c-pink, .light svg circle.c-pink, .light svg ellipse.c-pink { fill: #FBEAF0; stroke: #D4537E; }
.light svg rect.c-gray, .light svg circle.c-gray, .light svg ellipse.c-gray { fill: #F1EFE8; stroke: #888780; }
.light svg rect.c-blue, .light svg circle.c-blue, .light svg ellipse.c-blue { fill: #E6F1FB; stroke: #378ADD; }
.light svg rect.c-green, .light svg circle.c-green, .light svg ellipse.c-green { fill: #EAF3DE; stroke: #639922; }
.light svg rect.c-amber, .light svg circle.c-amber, .light svg ellipse.c-amber { fill: #FAEEDA; stroke: #BA7517; }
.light svg rect.c-red, .light svg circle.c-red, .light svg ellipse.c-red { fill: #FCEBEB; stroke: #E24B4A; }

/* ── Pre-styled form elements ──────────────────────────────────────── */
button {
  background: transparent;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  color: var(--color-text-primary);
  padding: 6px 14px;
  font-size: 14px;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: background 0.15s, transform 0.1s;
}
button:hover { background: var(--color-background-secondary); }
button:active { transform: scale(0.98); }

input[type="range"] {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  background: var(--color-border-secondary);
  border-radius: 2px;
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-text-primary);
  cursor: pointer;
}

input[type="text"], input[type="number"], textarea, select {
  height: 36px;
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-md);
  color: var(--color-text-primary);
  padding: 0 10px;
  font-size: 14px;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s;
}
input:hover, textarea:hover, select:hover { border-color: var(--color-border-secondary); }
input:focus, textarea:focus, select:focus { border-color: var(--color-border-primary); }

/* ── Utility classes ───────────────────────────────────────────────── */
.metric-card {
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 16px;
}
.metric-value { font-size: 28px; font-weight: 500; color: var(--color-text-primary); }
.metric-label { font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; }
.metric-change { font-size: 12px; margin-top: 4px; }
.metric-change.up { color: var(--color-text-success); }
.metric-change.down { color: var(--color-text-danger); }

/* ── Fade-in animation for new elements ────────────────────────────── */
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
`;
