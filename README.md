# Home Screens Plugin Template

Starter template for building plugins for [Home Screens](https://github.com/home-screens/home-screens), a smart display system that runs on Raspberry Pi.

Plugins are IIFE bundles loaded at runtime. The host app provides React and ReactDOM as globals, so your bundle stays small and fast.

## Quick Start

```bash
# 1. Clone or use this template
git clone https://github.com/home-screens/home-screens-plugin-template.git my-plugin
cd my-plugin

# 2. Install dependencies
npm install

# 3. Edit manifest.json — set your plugin id, name, category, icon, etc.
# 4. Write your component in src/index.tsx
# 5. Build the IIFE bundle
npm run build
```

This produces `dist/bundle.js` — the single file the host app loads at runtime.

## Project Structure

```
my-plugin/
  manifest.json       Plugin metadata, config schema, defaults
  src/
    index.tsx          Your display component (default export)
    hs-sdk.d.ts        Type stubs for host globals (full SDK surface)
    hs-plugin.d.ts     Type definitions for plugin props
  vite.config.ts       IIFE build configuration (classic JSX transform)
  dist/
    bundle.js          Built output (git-ignored)
```

## Manifest Reference

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique plugin identifier. Use kebab-case (e.g. `weather-radar`). |
| `name` | `string` | Human-readable display name shown in the editor palette. |
| `version` | `string` | Semver version of your plugin. |
| `description` | `string` | Short description shown in the plugin store and palette tooltip. |
| `author` | `string` | Your GitHub username or name. |
| `license` | `string` | SPDX license identifier. |
| `minAppVersion` | `string` | Minimum Home Screens version required (e.g. `0.20.0`). |
| `moduleType` | `string` | Module type registered with the host. Must match `id`. |
| `category` | `string` | One of the built-in categories or a custom string (see below). |
| `icon` | `string` | Lucide icon name for the palette (see available icons below). |
| `defaultConfig` | `object` | Default values for every config key your component reads. |
| `defaultSize` | `{ w, h }` | Default width and height in pixels on the 1080x1920 canvas. |
| `defaultStyle` | `object` | Optional partial style overrides (e.g. `{ "padding": 0 }`). Merged with the default module style. |
| `configSchema` | `object` | JSON Schema describing your config fields with UI hints. |
| `exports` | `object` | Map of named exports. `{ "component": "default" }` is required. Optionally add `"configSection": "ConfigSection"`. |
| `dataRequirements` | `string[]` | Data the host should inject: `"location"`, `"weather"`, `"calendar"`. |
| `prefetchUrl` | `string \| null` | Optional API URL the host prefetches for the plugin. |
| `permissions` | `string[]` | Capability declarations: `"network"`, `"secrets"`, `"events"`, `"storage"`. |
| `secrets` | `array` | API key declarations for the server-side proxy (see Secrets section). |
| `allowedDomains` | `string[]` | Upstream domains the proxy is allowed to reach (e.g. `["api.example.com"]`). |
| `configMigrations` | `object` | Maps version keys to `{ renames, defaults }` for config schema changes. |

### Categories

Plugins should use one of the built-in categories, but custom category strings are also accepted:

- `Time & Date`
- `Weather & Environment`
- `News & Finance`
- `Knowledge & Fun`
- `Personal`
- `Media & Display`
- `Travel`

Custom categories appear after built-in categories in the palette, sorted alphabetically.

### Config Schema

The `configSchema` follows JSON Schema with additional `ui:*` hints for the auto-generated config panel:

#### Widgets

| Widget | Description |
|---|---|
| `ui:widget: "text"` | Single-line text input |
| `ui:widget: "textarea"` | Multi-line text input |
| `ui:widget: "number"` | Numeric input |
| `ui:widget: "toggle"` | Boolean toggle switch |
| `ui:widget: "slider"` | Range slider (use with `minimum`, `maximum`, `ui:step`) |
| `ui:widget: "color"` | Color picker |
| `ui:widget: "select"` | Dropdown (use with `enum` and `enumLabels`) |
| `ui:widget: "multiselect"` | Checkbox group (use with `enum` and `enumLabels`) |
| `ui:widget: "time"` | HH:MM time picker |

#### Advanced Features

| Property | Description |
|---|---|
| `ui:group` | Visual section grouping. Fields with the same `ui:group` string are grouped under a heading. |
| `ui:showWhen` | Conditional visibility. `{ "field": "showBorder", "equals": true }` shows the field only when `showBorder` is `true`. |
| `ui:placeholder` | Placeholder text for input fields. |
| `description` | Help text rendered below the control. |
| `type: "array"` | Renders a list editor with add/remove buttons. Use `items` to define the schema for each element. |
| `type: "object"` | Renders nested properties in an indented section. Use `properties` to define sub-fields. |

## Component Props

Your default export receives these props from the host:

```typescript
interface PluginComponentProps {
  /** Merged config: manifest defaults + user overrides */
  config: Record<string, unknown>;

  /** Theme styling from the module's style settings */
  style: {
    fontSize: number;
    fontFamily: string;
    textColor: string;        // NOTE: "textColor", not "color"
    backgroundColor: string;
    borderRadius: number;
    padding: number;
    opacity: number;
    backdropBlur: number;
  };

  /** IANA timezone from global settings (e.g. "America/New_York") */
  timezone?: string;

  /** Injected when dataRequirements includes "location" */
  latitude?: number;
  longitude?: number;

  /** Injected when dataRequirements includes "weather" */
  hourly?: unknown[];
  forecast?: unknown[];
  minutely?: unknown;
  alerts?: unknown;
  units?: string;
  locationMissing?: boolean;

  /** Injected when dataRequirements includes "calendar" */
  events?: unknown[];
}
```

### Applying Module Styles

**Important:** Built-in modules are wrapped in `ModuleWrapper` which applies background, blur, radius, and padding. Plugins receive the raw `style` prop and must apply these themselves on the root element:

```typescript
<div style={{
  width: '100%', height: '100%', overflow: 'hidden',
  fontFamily: style.fontFamily,
  fontSize: style.fontSize,
  color: style.textColor,
  backgroundColor: style.backgroundColor,
  borderRadius: style.borderRadius,
  padding: style.padding,
  opacity: style.opacity,
  backdropFilter: `blur(${style.backdropBlur ?? 0}px)`,
  WebkitBackdropFilter: `blur(${style.backdropBlur ?? 0}px)`,
  boxSizing: 'border-box',
}}>
  {/* your content */}
</div>
```

## SDK Reference

The host exposes `window.__HS_SDK__` with UI components, hooks, and utilities. Full type declarations are in `src/hs-sdk.d.ts`.

### UI Components

Available in both display and editor contexts:

| Component | Props | Description |
|---|---|---|
| `Slider` | `label, value, min, max, step?, onChange` | Numeric range slider |
| `Toggle` | `label, checked, onChange` | Boolean toggle switch |
| `ColorPicker` | `label, value, onChange` | Color picker |
| `SectionHeading` | `children` | Visual section header |
| `ModuleLoadingState` | `loading?, error?, children` | Loading/error state wrapper |

### Editor-Only Components

These are `undefined` on the display page — check before using:

| Component | Props | Description |
|---|---|---|
| `AccordionSection` | `title, defaultOpen?, children` | Collapsible config section |
| `useModuleConfig` | `(moduleId, screenId) => { config, set }` | Typed config read/write hook |

### Data Fetching

```typescript
// Simple polling hook (client-side fetch)
const { useFetchData } = window.__HS_SDK__;
const [data, error] = useFetchData<MyType>('/api/some-url', 60000);

// Server-side proxy with secret injection
const { pluginFetch } = window.__HS_SDK__;
const res = await pluginFetch('my-plugin', {
  url: 'https://api.example.com/data',
  secretInjections: { header: { 'Authorization': 'Bearer {{api_key}}' } },
  cacheTtlMs: 60000,
});
```

### Host Settings

```typescript
const settings = window.__HS_SDK__.getHostSettings();
// { timezone, units, latitude, longitude, displayWidth, displayHeight, appVersion }
```

### Events

One-way communication from plugin to host:

```typescript
const { emit } = window.__HS_SDK__;
emit({ type: 'navigate', direction: 'next' });
emit({ type: 'refresh' });
emit({ type: 'log', level: 'warn', message: 'Something happened' });
```

### Display Cache

In-memory cache for data persistence between renders and screen transitions:

```typescript
const { displayCache } = window.__HS_SDK__;
displayCache.set('my-key', myData);
const cached = displayCache.get('my-key');
```

## Secrets & Server-Side Proxy

For plugins that need external API access with authentication:

### Declaring Secrets

Add a `secrets` array and `allowedDomains` to your manifest:

```json
{
  "secrets": [
    {
      "key": "api_key",
      "label": "API Key",
      "description": "Your API key from the service dashboard",
      "required": true,
      "placeholder": "sk-..."
    }
  ],
  "allowedDomains": ["api.example.com"],
  "permissions": ["network", "secrets"]
}
```

Users configure secrets in the editor's property panel. The values are stored server-side and never sent to the client.

### Using the Proxy

```typescript
const res = await window.__HS_SDK__.pluginFetch('my-plugin', {
  url: 'https://api.example.com/data',
  method: 'GET',
  secretInjections: {
    header: { 'Authorization': 'Bearer {{api_key}}' },  // {{key}} resolved server-side
  },
  cacheTtlMs: 60000,  // server-side cache TTL (0-3600000ms)
});
const data = await res.json();
```

**Proxy constraints:**
- Upstream URL must match a domain in `allowedDomains` (supports wildcards: `*.example.com`)
- Rate limited: 60 requests/minute per plugin
- Max response size: 5MB
- Supported methods: GET, POST, PUT, PATCH
- Secret `{{key}}` placeholders are resolved server-side — never exposed to the client

## Custom Config Section

For config UI beyond what the schema renderer supports, export a named component:

```typescript
import type { PluginConfigSectionProps } from './hs-plugin';

export function ConfigSection({ config, onChange }: PluginConfigSectionProps) {
  const { Slider, Toggle, INPUT_CLASS } = window.__HS_SDK__;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toggle
        label="Show Border"
        checked={config.showBorder !== false}
        onChange={(v) => onChange({ showBorder: v })}
      />
      <Slider
        label="Refresh (seconds)"
        value={((config.refreshIntervalMs as number) || 60000) / 1000}
        min={5} max={300} step={5}
        onChange={(v) => onChange({ refreshIntervalMs: v * 1000 })}
      />
    </div>
  );
}
```

Update manifest exports: `{ "component": "default", "configSection": "ConfigSection" }`

When a custom `configSection` is exported, the host uses it **instead of** the auto-generated schema UI.

## Development

### Dev Mode Loading

1. Start your plugin's dev server:
   ```bash
   npm run dev
   ```
   This builds the bundle, starts a file watcher for rebuilds, and serves the plugin directory on `http://localhost:5173` with CORS headers.

2. In the Home Screens editor, open the Plugin Store and go to the **Developer** tab.

3. Enter `http://localhost:5173` and click **Load**.

The plugin will:
- Load immediately from your dev server
- Auto-reload every 2 seconds when the bundle changes (via ETag polling)
- Register the manifest server-side so `pluginFetch` works during development
- Show a **Dev** badge in the editor palette
- Be stored in `localStorage` only — won't persist across browsers

### Source Maps

Source maps are enabled by default (`sourcemap: true` in `vite.config.ts`). Browser DevTools will pick them up automatically.

## Config Migration

When you release a new version with config schema changes, existing module instances keep their old config.

### Automatic Deep-Merge

On version change, the host deep-merges each module's existing config with your new `defaultConfig`. New fields get default values; existing fields are preserved.

### Explicit Migrations

For breaking changes (renames, removed fields), add `configMigrations`:

```json
{
  "version": "2.0.0",
  "configMigrations": {
    "1.0.0": {
      "renames": { "oldFieldName": "newFieldName" },
      "defaults": { "newRequiredField": 42 }
    }
  }
}
```

Each key is a version — migrations are applied for versions strictly between the old installed version and the new manifest version. Renames and defaults are applied before the deep-merge.

**Important:** The migration key must be **less than** `manifest.version` for it to run.

## Permissions

Plugins declare which capabilities they use. These are shown to users during install but not enforced at runtime:

| Permission | Meaning |
|---|---|
| `network` | Makes HTTP requests via the server-side proxy (`pluginFetch`) |
| `secrets` | Stores API keys or credentials |
| `events` | Emits host events (navigate, refresh, etc.) |
| `storage` | Uses localStorage for persistent state |

Plugins submitted to the registry must honestly declare all capabilities — undeclared capabilities will be flagged during review.

## Building

```bash
npm run build    # One-time production build
npm run dev      # Watch + serve for development (localhost:5173)
```

The build uses the **classic JSX transform** (`React.createElement`) because the host provides `window.React` which does not include `jsx`/`jsxs` from `react/jsx-runtime`. Do not change the `esbuild.jsx` setting in `vite.config.ts`.

## Publishing

1. Create a GitHub repository for your plugin.
2. Tag a release with a semver version (e.g. `v1.0.0`).
3. Create a release tarball and attach it to the GitHub release.
4. Submit a PR to the [home-screens-plugins](https://github.com/home-screens/home-screens-plugins) registry.

### Creating the Release Tarball

The tarball **must** contain a single top-level directory wrapping `manifest.json` and `dist/`. The install flow extracts with `tar --strip-components=1`, so files at the root of the archive will be lost.

```bash
npm run build

mkdir -p /tmp/my-plugin-pkg/my-plugin/dist
cp manifest.json /tmp/my-plugin-pkg/my-plugin/
cp dist/bundle.js /tmp/my-plugin-pkg/my-plugin/dist/
cp dist/bundle.js.map /tmp/my-plugin-pkg/my-plugin/dist/  # optional

tar -czf plugin.tar.gz -C /tmp/my-plugin-pkg my-plugin

# Compute the SHA-256 hash (needed for the registry entry)
shasum -a 256 plugin.tar.gz    # macOS
sha256sum plugin.tar.gz        # Linux
```

## Available Icons

These Lucide icon names are supported by the host app's icon resolver. Use one of these in your manifest's `icon` field:

`Clock` `CalendarDays` `CloudSun` `Hourglass` `Laugh` `Type` `ImageIcon` `Quote` `ListTodo` `StickyNote` `HandMetal` `Newspaper` `TrendingUp` `Bitcoin` `BookOpen` `History` `Moon` `Sunrise` `Image` `QrCode` `BarChart3` `Car` `Trophy` `Wind` `ListChecks` `CloudRain` `CalendarRange` `Trash2` `Medal` `Sparkles` `Calendar` `Globe` `UtensilsCrossed` `Flag` `ClipboardList` `Puzzle` `Radar` `Music` `Tv` `Radio` `Gauge` `Thermometer` `Droplets` `Zap` `Bell` `MapPin` `Navigation` `Wifi` `Heart` `Star` `Camera` `Video` `Mic` `Volume2` `Headphones` `Monitor`

Unknown icon names fall back to `Puzzle`.

## Tips and Constraints

- **Do not bundle React.** The host provides `window.React` and `window.ReactDOM`. The Vite config marks them as external.
- **Use the classic JSX transform.** The Vite config uses `React.createElement`, not `jsx`/`jsxs`. Do not change this.
- **Apply module wrapper styles.** Plugins must apply `backgroundColor`, `backdropFilter`, `borderRadius`, `padding`, and `opacity` from the `style` prop on their root element. See the example in `src/index.tsx`.
- **Use `style.textColor`, not `style.color`.** The host's `ModuleStyle` uses `textColor`.
- **Keep bundles small.** Plugins load at runtime on a Raspberry Pi. Avoid heavy dependencies.
- **Use inline styles.** Plugins cannot inject stylesheets. The `style` prop gives you theme values.
- **Fill the container.** Your component renders inside a positioned box matching `defaultSize`. Use `width: 100%` and `height: 100%`.
- **Use `pluginFetch` for external APIs.** The server-side proxy handles CORS, secrets, and caching. Declare `allowedDomains` and `permissions: ["network"]`.
- **Respect the refresh interval.** If your plugin polls, use a config field so users can control resource usage.
- **Test at 1080x1920.** The display is portrait.
- **The `moduleType` must match the `id`.** The host uses this to register and look up your component.

## License

MIT
