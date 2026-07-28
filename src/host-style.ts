// The host's module frame, implemented plugin-side.
//
// Why this file exists: the host does NOT wrap plugin modules in its
// `ModuleWrapper` the way it wraps built-in ones. A plugin renders its own
// root element, so every field of `ModuleStyle` — every slider in the
// editor's Style panel — only takes effect if the plugin implements it. A
// field you don't read is a control that silently does nothing for the user.
//
// Three of those fields are easy to get wrong, which is why this is a shared
// helper rather than an inline style object:
//
//   Border and shadow. `borderWidth` / `borderColor` / `shadowSize` were
//   added to the host after the first plugins shipped, so the obvious
//   hand-written root frame omits them.
//
//   Opacity under backdrop blur. Setting `opacity` on the element while
//   `backdrop-filter` is active makes the blur invisible: an opaque
//   background covers the blurred backdrop completely and Chrome renders
//   nothing. The host bakes the opacity into the background's alpha channel
//   instead; `hostFrameStyle` does the same.
//
//   Font family. `style.fontFamily` is a registry ID ("inter", "playfair"),
//   not a CSS stack. Emitting it verbatim gives `font-family: inter`, which
//   matches nothing and silently falls back to the browser's default serif
//   while every built-in module renders Inter. See `resolveFontStack`.
//
// Use it for your root element and spread your own layout on top:
//
//   <div style={{ ...hostFrameStyle(style), display: 'flex', gap: '0.75em' }}>
//
// SIZING IS STILL YOURS. This file applies the host's font size to the root,
// which only reaches content authored in `em`/`rem` or derived from
// `style.fontSize`. Hard-coded pixel values ignore the Text size slider
// entirely — a module sized to fill a quarter of a 4K screen will still draw
// 12px labels. Author dimensions in `em` wherever you can.

import { useMemo } from 'react';
import type { CSSProperties } from 'react';

/** The host's `ModuleStyle`, declared here rather than imported so this file
 *  is self-contained and can be copied between plugins verbatim. Structural
 *  typing means a plugin's own `ModuleStyle` satisfies it either way — and a
 *  plugin whose copy predates the last three fields still type-checks,
 *  because they're optional. */
export interface HostModuleStyle {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  opacity: number;
  backdropBlur: number;
  borderWidth?: number;
  borderColor?: string;
  shadowSize?: number;
}

/** The host's default border color, matching its `ModuleWrapper`. */
const DEFAULT_BORDER_COLOR = 'rgba(255, 255, 255, 0.15)';

/** Fully parse a color into [r, g, b, a] — hex in 3, 4, 6, or 8 digits, or an
 *  `rgb()`/`rgba()` function in either comma or space-slash form, with
 *  numeric or percentage channels.
 *
 *  "Fully" is the point. A parser that reads the first three channels and
 *  stops looks like it succeeded on `rgb(0 0 0 / 50%)` while dropping the
 *  half of the value that matters, so callers can't tell a complete read from
 *  a partial one. Null means "ask the browser", not "close enough". */
export function parseRgba(input: string): [number, number, number, number] | null {
  const value = input.trim();

  const hex = /^#([0-9a-f]+)$/i.exec(value);
  if (hex) {
    const digits = hex[1];
    const short = digits.length === 3 || digits.length === 4;
    if (!short && digits.length !== 6 && digits.length !== 8) return null;
    const at = (i: number): number => (short
      ? parseInt(digits[i] + digits[i], 16)
      : parseInt(digits.slice(i * 2, i * 2 + 2), 16));
    const hasAlpha = digits.length === 4 || digits.length === 8;
    return [at(0), at(1), at(2), hasAlpha ? at(3) / 255 : 1];
  }

  const fn = /^rgba?\(([^)]*)\)$/i.exec(value);
  if (fn) {
    // Both legal separator styles at once: `r, g, b, a` and `r g b / a`.
    const parts = fn[1].trim().split(/\s*[,/]\s*|\s+/).filter((p) => p !== '');
    if (parts.length !== 3 && parts.length !== 4) return null;
    const num = (p: string, full: number): number => (p.endsWith('%')
      ? (Number(p.slice(0, -1)) / 100) * full
      : Number(p));
    const rgb = parts.slice(0, 3).map((p) => Math.round(num(p, 255)));
    const alpha = parts.length === 4 ? num(parts[3], 1) : 1;
    const ok = rgb.every((c) => Number.isFinite(c) && c >= 0 && c <= 255)
      && Number.isFinite(alpha) && alpha >= 0 && alpha <= 1;
    if (ok) return [rgb[0], rgb[1], rgb[2], alpha];
  }

  return null;
}

/** The [r, g, b] of any color `parseRgba` can read, dropping the alpha. Null
 *  for anything else, so callers can fall back rather than emit a broken
 *  color string. */
export function parseColor(input: string): [number, number, number] | null {
  const rgba = parseRgba(input);
  return rgba ? [rgba[0], rgba[1], rgba[2]] : null;
}

/** One DOM probe per distinct string — the host re-renders the module on
 *  every tick and the answer never changes. */
const resolved = new Map<string, string | null>();

/** The same color in a form `parseRgba` can read, or null if it isn't a
 *  color at all.
 *
 *  The host's color picker accepts anything the browser calls valid and
 *  stores the string verbatim, so `black`, `hsl(0 0% 10%)`, `#000000cc`, and
 *  `rgb(0 0 0 / 50%)` all reach plugin code. Anything the parser above can't
 *  read goes to the browser, which is the only thing that knows what
 *  `rebeccapurple` is. Outside a DOM (unit tests) there is nothing to ask
 *  and the caller falls back. */
export function resolveColor(input: string): string | null {
  if (parseRgba(input)) return input;

  const cached = resolved.get(input);
  if (cached !== undefined) return cached;

  // No DOM to ask yet. Fall back WITHOUT caching: a null here means "nobody
  // could answer", not "not a color". Caching it would pin the fallback for
  // the page's lifetime when the only problem was that `document.body` hadn't
  // mounted at the moment this color was first seen.
  if (typeof document === 'undefined' || !document.body) return null;

  let out: string | null = null;
  const probe = document.createElement('div');
  probe.style.color = input;
  // An invalid value leaves the property untouched; without this check the
  // computed style below would hand back the inherited color and turn
  // gibberish into whatever the page happens to be using.
  if (probe.style.color !== '') {
    // A detached element has no computed style, so the probe has to be in
    // the document. `display: none` keeps it out of layout.
    probe.style.display = 'none';
    document.body.appendChild(probe);
    try {
      const computed = getComputedStyle(probe).color;
      out = parseRgba(computed) ? computed : null;
    } finally {
      probe.remove();
    }
  }
  // A probe ran, so this answer is final either way — an unreadable string is
  // not going to become readable later.
  resolved.set(input, out);
  return out;
}

/** Bake an alpha into a color so a blurred module can carry its opacity in
 *  the background rather than on the element. Null when the color can't be
 *  read at all, so the caller can fall back to element opacity — a slightly
 *  weaker blur beats an opacity setting that does nothing. */
export function colorWithAlpha(color: string, alpha: number): string | null {
  if (alpha >= 1) return color;
  const resolvedColor = resolveColor(color);
  // A background that is already translucent keeps its own alpha, scaled, so
  // a default like rgba(0, 0, 0, 0.35) doesn't jump to opaque.
  const rgba = resolvedColor ? parseRgba(resolvedColor) : null;
  if (!rgba) return null;
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3] * alpha})`;
}

/** The host stores a font *ID* in `ModuleStyle.fontFamily` — "inter",
 *  "playfair" — and resolves it to a CSS stack in its own `ModuleWrapper`.
 *  Plugins get the raw ID, so a plugin that passes it straight to
 *  `font-family` emits an unknown family and renders in the browser default
 *  while every module around it renders Inter.
 *
 *  Mirrors the host's `font-registry`. Anything not in the table is returned
 *  unchanged: older configs stored raw CSS stacks, and a stack the host adds
 *  after this plugin ships should pass through rather than be swallowed. */
const FONT_STACKS: Record<string, string> = {
  // Sans
  'inter': 'var(--font-inter), system-ui, sans-serif',
  'roboto': 'var(--font-roboto), system-ui, sans-serif',
  'poppins': 'var(--font-poppins), system-ui, sans-serif',
  'system-ui': 'system-ui, -apple-system, "Segoe UI", sans-serif',
  // Serif
  'playfair': 'var(--font-playfair), Georgia, serif',
  'lora': 'var(--font-lora), Georgia, serif',
  'dm-serif': 'var(--font-dm-serif), Georgia, serif',
  'georgia': 'Georgia, "Times New Roman", serif',
  // Monospace
  'jetbrains': 'var(--font-jetbrains), ui-monospace, monospace',
  'mono': 'ui-monospace, "SF Mono", Menlo, monospace',
  // Display and script
  'bebas': 'var(--font-bebas), Impact, sans-serif',
  'caveat': 'var(--font-caveat), cursive',
  'pacifico': 'var(--font-pacifico), cursive',
};

/** Raw CSS stacks stored by configs that predate the font registry, mapped to
 *  the ID that superseded them — same upgrade the host performs. */
const LEGACY_FONT_IDS: Record<string, string> = {
  'Inter, system-ui, sans-serif': 'inter',
  'Georgia, serif': 'georgia',
  'monospace': 'mono',
  'system-ui, sans-serif': 'system-ui',
};

export function resolveFontStack(value: string | undefined | null): string | undefined {
  const id = value?.trim();
  if (!id) return undefined;
  return FONT_STACKS[id] ?? FONT_STACKS[LEGACY_FONT_IDS[id]] ?? id;
}

/** The host's module shadow, matched to what its `buildModuleShadow` gives
 *  every built-in: a hairline top highlight, a cast shadow, and a faint
 *  ambient ring. Reimplemented rather than imported — plugins can't reach
 *  into host modules. */
export function moduleShadow(size: number): string | undefined {
  if (size <= 0) return undefined;
  const offset = Math.round(size / 2);
  const ambient = Math.round(size / 2);
  return 'inset 0 1px 0 rgba(255, 255, 255, 0.12), '
    + `0 ${offset}px ${size}px rgba(0, 0, 0, 0.8), `
    + `0 0 ${ambient}px rgba(255, 255, 255, 0.04)`;
}

/** The font size a plugin's pixel dimensions are authored against, when it
 *  doesn't say otherwise. Matches the host's own `DEFAULT_MODULE_STYLE`. */
export const DEFAULT_BASE_FONT_SIZE = 16;

export interface HostFrameOptions {
  /** The font size this plugin's pixel dimensions were authored against —
   *  its manifest `defaultStyle.fontSize`. Sets the `--u` scale variable (see
   *  `scalePx`). Defaults to the host's own default. */
  baseFontSize?: number;
}

/** Scale an authored pixel dimension by the host's Text size.
 *
 *  The host's Text size reaches the root as a font size, so `em` values
 *  follow it and pixel values do not. `em` isn't always usable though: it
 *  resolves against the element's OWN font size, so two elements with
 *  different type but a shared width (a table cell and its column header)
 *  would end up different widths. `--u` is published once on the root by
 *  `hostFrameStyle`, so every `calc(Npx * var(--u))` lands on the same
 *  number wherever it sits — and it works inside plain constant style
 *  objects, which a React hook cannot.
 *
 *  Falls back to 1 so styles still resolve outside a host frame. */
export function scalePx(n: number): string {
  return `calc(${n}px * var(--u, 1))`;
}

/** Every `ModuleStyle` field, applied the way the host applies it to
 *  built-in modules. Spread onto your root element, then add your layout.
 *
 *  Resolving an exotic background color can touch the DOM (see
 *  `resolveColor`), so call this from a `useMemo` keyed on `style` rather
 *  than bare in a component body — see `useHostFrameStyle`. */
export function hostFrameStyle(
  style: HostModuleStyle,
  options: HostFrameOptions = {},
): CSSProperties {
  const base = options.baseFontSize ?? DEFAULT_BASE_FONT_SIZE;
  // Guard the zero/NaN case: a bad font size would otherwise multiply every
  // scaled dimension by zero and render the module as a sliver.
  const fontSize = Number.isFinite(style.fontSize) && style.fontSize > 0
    ? style.fontSize
    : base;
  const blur = style.backdropBlur ?? 0;
  const hasBlur = blur > 0;
  const borderWidth = style.borderWidth ?? 0;
  const shadowSize = style.shadowSize ?? 0;
  // See the header note: with blur on, the opacity has to live in the
  // background's alpha or the blur renders invisible.
  const bakedBackground = hasBlur
    ? colorWithAlpha(style.backgroundColor, style.opacity)
    : null;

  return {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    // Published for `scalePx`, so pixel dimensions can follow the Text size
    // slider the same way `em` type does.
    ['--u' as string]: fontSize / base,
    fontFamily: resolveFontStack(style.fontFamily),
    fontSize,
    color: style.textColor,
    backgroundColor: bakedBackground ?? style.backgroundColor,
    opacity: bakedBackground ? undefined : style.opacity,
    borderRadius: style.borderRadius,
    padding: style.padding,
    border: borderWidth > 0
      ? `${borderWidth}px solid ${style.borderColor ?? DEFAULT_BORDER_COLOR}`
      : undefined,
    boxShadow: moduleShadow(shadowSize),
    backdropFilter: hasBlur ? `blur(${blur}px)` : undefined,
    WebkitBackdropFilter: hasBlur ? `blur(${blur}px)` : undefined,
  };
}

/** `hostFrameStyle`, recomputed only when the style actually changes.
 *
 *  The host re-renders modules on a tick, and a bare call in a component body
 *  reruns the whole frame — including `resolveColor`'s DOM probe on a cold
 *  cache — on every one of them. Prefer this in components. */
export function useHostFrameStyle(
  style: HostModuleStyle,
  options: HostFrameOptions = {},
): CSSProperties {
  const baseFontSize = options.baseFontSize;
  return useMemo(
    () => hostFrameStyle(style, { baseFontSize }),
    [style, baseFontSize],
  );
}
