# US Flag Status Plugin

A plugin for [Home Screens](https://homescreens.dev) — the open-source smart display system for Raspberry Pi — that shows whether the US flag is currently at full-staff or half-staff, with the proclamation reason when applicable.

## Features

- **Live full-staff / half-staff status** sourced from the public [FlagWatch API](https://flagwatch.net)
- **Proclamation reason** shown on half-staff days (optional, toggleable)
- **Eastern-time evaluation** so federal proclamations switch at the right moment regardless of display timezone
- **Configurable refresh interval** (30–120 minutes)
- **No API key required**

## Installation

Install this plugin from the Plugin Store inside the Home Screens editor, or download a release tarball from the [Releases](https://github.com/home-screens/home-screens-plugin-flag-status/releases) page and side-load it.

For general Home Screens setup, see the [documentation](https://homescreens.dev/docs).

## Configuration

| Setting | Default | Description |
|---|---|---|
| Show Reason | `true` | Display the proclamation reason when the flag is at half-staff |
| Refresh Interval | `30 min` | How often to poll the FlagWatch API (30–120 minutes) |

## Data Source

Flag status is fetched from `https://flagwatch.net/api/v1/` via the Home Screens server-side proxy. FlagWatch tracks federal proclamations from the White House and state governors.

## Building

```bash
npm install
npm run build   # Produces dist/bundle.js
npm run dev     # Watch + serve on localhost:5173 for dev-mode loading
```

See the [plugin template README](https://github.com/home-screens/home-screens-plugin-template) for details on the plugin SDK, manifest format, and development workflow.

## License

MIT
