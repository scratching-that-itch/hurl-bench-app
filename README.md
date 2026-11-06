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

- [Node.js](https://nodejs.org) 18+ and [pnpm](https://pnpm.io) (see ADR 0004)
- [Rust](https://rustup.rs) (stable)
- Tauri platform prerequisites — on macOS: Xcode Command Line Tools
  (`xcode-select --install`). See
  <https://tauri.app/start/prerequisites/> for other platforms.
- Optional: [Zig](https://ziglang.org) 0.17 — only for the
  `hurl-bench-sample-server` endpoint, not for the app itself.

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

## Test server & sample workspace

[`hurl-bench-sample-server`](../hurl-bench-sample-server/) (a sibling
folder) is a small Zig + [http.zig](https://github.com/karlseguin/http.zig)
service (ADR 0006) that implements every scenario from the
[hurl README samples](https://github.com/Orange-OpenSource/hurl#samples) on
`127.0.0.1:8383` — a deterministic endpoint for trying out the app.

```bash
cd ../hurl-bench-sample-server
zig build run    # needs Zig 0.17; binary: zig-out/bin/hurl-bench-sample-server
```

Matching `.hurl` files live in `../workspace/samples/` (next to this repo):
open `workspace/` in the app, or run the whole suite with the CLI —
see [workspace/samples/README.md](../workspace/samples/README.md).

## Project layout

```
src/                  Vue frontend
  components/         App shell (sidebar, request bar, editor, response pane)
  components/ui/      shadcn-vue components
  lib/                hurl serializer + parser, runner bridge, file commands
  stores/             workspace state (reactive module, files on disk)
src-tauri/            Tauri backend
  src/lib.rs          run_hurl (bundled hurl crate) + workspace file commands
decisions/            Architecture decision records
diary/                Development diary
style/                UI & code style guide

Sibling folders:
../hurl-bench-sample-server/   Zig + http.zig test endpoint for the hurl samples (ADR 0006)
../workspace/samples/          .hurl files mirroring the hurl README samples
```

## Docs

- [decisions/](decisions/README.md) — why the stack and execution model look
  the way they do
- [diary/](diary/README.md) — chronological dev log and gotchas
- [style/](style/README.md) — UI density, colors, and code conventions
