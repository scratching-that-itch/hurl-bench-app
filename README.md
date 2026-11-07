# Hurl Bench

A desktop designer and runner for [hurl](https://hurl.dev) requests, with an
Insomnia/Postman-style UI. Built with Tauri 2, Vue 3, TypeScript, and
shadcn-vue (Tailwind CSS v4).

Hurl is **bundled** as a Rust library (`hurl` 8.1.0 crate) — you do **not**
need the hurl CLI installed.

## Features

- Workspace = a folder of real `.hurl` files on disk — files saved by the
  app are valid hurl and run unchanged with `hurl file.hurl`, in your
  terminal or CI/CD
- Request designer: params, headers, body, asserts — with a live Raw Hurl
  preview; files beyond the designer subset open in raw mode and are saved
  verbatim
- One-click Send (⌘↵) per entry, or run a whole file; hurl runs in-process
- Explicit save (⌘S) with dirty indicators; runs always match what's on disk
- Response pane: status, duration, HTTP version, body, headers, raw report
- Run history: every run is saved next to the `.hurl` file as
  `<name>.hurl.<timestamp>.history.txt`, in curl-verbose style (`>`
  request as sent, `<` status + headers, body; binary bodies omitted) —
  browse it inline from the History button, latest first
- Light/dark theme toggle (dark default, persisted)

## Prerequisites

- [Node.js](https://nodejs.org) 18+ and [pnpm](https://pnpm.io)
- [Rust](https://rustup.rs) (stable)
- Tauri platform prerequisites — on macOS: Xcode Command Line Tools
  (`xcode-select --install`). See
  <https://tauri.app/start/prerequisites/> for other platforms.

## Install

```bash
pnpm install
```

## Run in development

```bash
pnpm tauri dev
```

Starts the Vite dev server and opens the desktop app with hot reload. The
first run compiles the Rust backend (including the bundled hurl crate), so
it takes a few minutes; subsequent runs are fast.

Browser-only preview (UI works, but Send needs the desktop runtime):

```bash
pnpm dev
```

## Build

Frontend only (type-check + bundle to `dist/`):

```bash
pnpm build
```

Full desktop app (frontend + release Rust binary + installer):

```bash
pnpm tauri build
```

Artifacts land in `src-tauri/target/release/bundle/` — on macOS an `.app`
under `bundle/macos/` and a `.dmg` under `bundle/dmg/`.

## Releases (GitHub Actions)

`.github/workflows/release.yml` builds installers for macOS (Apple Silicon)
and Windows (x64) and attaches them to a draft GitHub release.

To cut a release, bump `version` in `package.json` and
`src-tauri/tauri.conf.json`, then tag and push:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow runs on `v*` tags (or manually via *Actions → Release → Run
workflow*). Binaries are **unsigned**, so macOS will show a Gatekeeper
warning — right-click → Open, or run
`xattr -cr /Applications/hurl-bench.app`.

## Auto-update

The app checks `releases/latest/download/latest.json` on startup and offers
to download, install, and restart when a newer tag is published. Updates are
minisign-signed; the public key is baked into `src-tauri/tauri.conf.json`.

For CI to produce signed update artifacts (`latest.json` + `.sig` files),
add this repository secret (*Settings → Secrets and variables → Actions*):

- `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/hurl-bench-app.key`
  (generated locally with `pnpm tauri signer generate`; the key has no
  password, so `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` can stay unset).

Keep the private key safe — losing it means existing installs can no longer
verify updates. To sign the app bundles themselves (removing the Gatekeeper
warning), add the `APPLE_*` / Windows certificate secrets documented at
<https://tauri.app/distribute/sign/macos/>.

## Project layout

```
src/                  Vue frontend
  components/         App shell (sidebar, request bar, editor, response pane)
  components/ui/      shadcn-vue components
  lib/                hurl serializer + parser, runner bridge, file commands
  stores/             workspace state (reactive module, files on disk)
src-tauri/            Tauri backend
  src/lib.rs          run_hurl (bundled hurl crate) + workspace file commands
.github/workflows/    Release pipeline (GitHub Actions)
```
