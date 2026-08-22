# OneSDK Probe Design

## Purpose

Build a temporary OneComme template that records the unmodified comment object delivered by OneSDK so normal and TwitCasting anonymous comments can be compared. This is an observation tool, not the First Comment BIG implementation, and it must not infer or hard-code an anonymous-number field.

## Runtime structure

The template follows the working NICO FLOW integration: `index.html` loads `../__origin/js/onesdk.js`, then subscribes to `comments` with `mode: 'diff'`, `disabledDelay: true`, and comment permission. Each item is captured at the start of the subscription callback before any display-model conversion or field-based decision.

`probe-core.js` is a dependency-free UMD module. It creates a detached, JSON-safe snapshot of a received value and derives a fixed comparison summary without interpreting field meaning. `script.js` owns OneSDK lifecycle, the capped in-memory log, Console output, DOM rendering, Copy Logs, and Clear Logs.

## Data handling

Each log entry contains a timestamp, a summary, and the complete JSON-safe comment snapshot. The public `window.__oneSDKProbeLog` array holds at most 100 entries; the oldest entry is removed first. Circular references, BigInt values, and serialization failures are represented safely so one malformed value cannot stop later captures.

The summary reads the requested paths only for comparison: top-level `service`; `comment.id`; and fields below `comment.data`, including `meta.anonymity` and existence-probe field `isAnonymous`. Missing values remain visibly distinguishable from false, zero, or an empty string. No summary value is used to classify a comment.

## User interface and privacy

The page shows connection status, log count, the newest summary, and its RAW JSON. Copy Logs serializes all in-memory entries to the clipboard; if clipboard access fails, it prints the same JSON to Console. Clear Logs empties the same public array and resets the display.

All comment text is inserted with `textContent`. The template performs no network requests, analytics, persistent storage, or automatic Git/file writes.

## Packaging scope

`template.json` and `README.txt` are included because the known working NICO FLOW ZIP uses them for OneComme metadata and in-package instructions. No ZIP generator or build tool is added. A future manual ZIP should contain one top-level `one-sdk-probe/` directory with `index.html`, `style.css`, `probe-core.js`, `script.js`, `template.json`, and `README.txt`.

## Verification

Node's built-in test runner covers snapshot detachment, exceptional JSON values, requested summary paths, missing-value distinction, and the 100-entry cap helper. A minimal browser fixture supplies a fake OneSDK and exercises callback-to-screen behavior without external libraries. Static checks cover JavaScript syntax, DOM IDs, external-send APIs, and capture ordering. Real OneComme and TwitCasting receipt remain explicitly unverified until run in the user's environment.
