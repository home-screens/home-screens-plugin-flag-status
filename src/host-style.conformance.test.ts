/**
 * The behaviour every copy of host-style.ts must share.
 *
 * This file is duplicated across every Home Screens plugin (plugins can't
 * import from each other or from the host), and the copies have already
 * drifted apart internally — different color parsers, different probe
 * strategies, extra helpers a given plugin needed. That is fine, and keeping
 * them byte-identical is not worth the effort: what matters is that they all
 * still behave the same way toward the host's Style panel.
 *
 * So this is a conformance suite, not an implementation test. It asserts only
 * the contract, never the internals, and it is the same file in every plugin.
 * If a copy stops resolving font ids, stops baking opacity into the background
 * alpha under blur, or stops publishing `--u`, it fails here — which is how
 * the rss copy's missing font resolution stayed invisible until an audit found
 * it by hand.
 *
 * Keep it identical across plugins. When the host gains a style field, add a
 * case here and run it everywhere.
 */

import { describe, it, expect } from 'vitest';
import {
  colorWithAlpha,
  hostFrameStyle,
  moduleShadow,
  resolveFontStack,
  scalePx,
} from './host-style';

const S = {
  fontSize: 16,
  fontFamily: 'inter',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  borderRadius: 12,
  padding: 16,
  opacity: 1,
  backdropBlur: 0,
};

/** Read a property without asserting the return type's shape, so a copy that
 *  types its return more loosely still compiles here. */
const get = (o: object, k: string): unknown => (o as Record<string, unknown>)[k];

describe('host frame conformance', () => {
  describe('font family', () => {
    // The host stores a registry *id*, not a CSS stack. Emitting it raw asks
    // for a family that doesn't exist and silently falls back.
    it('resolves a font id to a real CSS stack', () => {
      expect(resolveFontStack('inter')).toContain('var(--font-inter)');
      expect(String(get(hostFrameStyle(S), 'fontFamily'))).toContain('var(--font-inter)');
    });

    it('passes an unrecognized family through unchanged', () => {
      // Legacy configs stored raw stacks, and the host may add ids after a
      // plugin ships; neither should be swallowed.
      expect(resolveFontStack('Comic Sans, cursive')).toBe('Comic Sans, cursive');
    });
  });

  describe('border and shadow', () => {
    it('draws a border only above zero width', () => {
      expect(get(hostFrameStyle(S), 'border')).toBeUndefined();
      expect(String(get(hostFrameStyle({ ...S, borderWidth: 2 }), 'border')))
        .toContain('2px solid');
    });

    it('draws a shadow only above zero size', () => {
      expect(moduleShadow(0)).toBeUndefined();
      expect(moduleShadow(16)).toContain('0 8px 16px');
    });
  });

  describe('opacity under backdrop blur', () => {
    // Opacity on the element hides the blur completely: the opaque background
    // covers the blurred backdrop and Chrome renders nothing.
    it('bakes into the background alpha when blur is on', () => {
      const s = hostFrameStyle({ ...S, opacity: 0.5, backdropBlur: 8 });
      expect(get(s, 'opacity')).toBeUndefined();
      expect(String(get(s, 'backgroundColor'))).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.5\)/);
    });

    it('stays on the element when there is no blur', () => {
      expect(get(hostFrameStyle({ ...S, opacity: 0.5 }), 'opacity')).toBe(0.5);
    });

    it('scales an already-translucent background rather than making it opaque', () => {
      const s = hostFrameStyle({
        ...S, backgroundColor: 'rgba(0, 0, 0, 0.4)', opacity: 0.5, backdropBlur: 8,
      });
      expect(String(get(s, 'backgroundColor'))).toMatch(/0\.2/);
    });
  });

  describe('the --u scale variable', () => {
    it('is published from the host Text size', () => {
      expect(get(hostFrameStyle(S), '--u')).toBe(1);
      expect(get(hostFrameStyle({ ...S, fontSize: 32 }), '--u')).toBe(2);
    });

    it('measures against the plugin authored base when one is given', () => {
      expect(get(hostFrameStyle({ ...S, fontSize: 28 }, { baseFontSize: 14 }), '--u')).toBe(2);
    });

    it('emits scalePx as a calc against it', () => {
      expect(scalePx(18)).toBe('calc(18px * var(--u, 1))');
    });
  });

  describe('bad input', () => {
    it('repairs a nonsense font size instead of collapsing the module', () => {
      // Zero would multiply every scaled dimension by zero; NaN would drop the
      // declaration entirely.
      for (const bad of [0, Number.NaN, -8, undefined as unknown as number]) {
        expect(get(hostFrameStyle({ ...S, fontSize: bad }), '--u')).toBe(1);
        expect(get(hostFrameStyle({ ...S, fontSize: bad }), 'fontSize')).toBe(16);
      }
    });

    it('returns null from colorWithAlpha for a color it cannot read', () => {
      // So the caller can fall back to element opacity rather than emit a
      // broken color string.
      expect(colorWithAlpha('not-a-color', 0.5)).toBeNull();
    });
  });
});
