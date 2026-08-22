# OneSDK Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dependency-free OneComme probe that safely captures and compares raw OneSDK comment objects without deciding where an anonymous number lives.

**Architecture:** A tested UMD core performs JSON-safe snapshot and summary operations. A browser adapter captures each comment at the callback boundary, stores at most 100 entries, and updates Console and DOM controls.

**Tech Stack:** HTML5, CSS, plain JavaScript, Node.js built-in test runner

**Spec:** `docs/superpowers/specs/2026-08-22-one-sdk-probe-design.md`

## Global Constraints

- Do not infer, classify, or hard-code an anonymous-number field.
- Capture before any display-model conversion or field-based decision.
- No fetch, analytics, localStorage, external runtime dependency, build tool, framework, or ZIP generator.
- Use `textContent` for received data.
- Keep at most 100 in-memory entries and expose them as `window.__oneSDKProbeLog`.

---

### Task 1: Tested probe core

**Files:**
- Create: `package.json`
- Create: `tests/probe-core.test.js`
- Create: `probe-core.js`

**Interfaces:**
- Produces: `OneSDKProbeCore.createSnapshot(value)`, `createSummary(snapshot)`, `appendCapped(array, value, limit)`, `formatJson(value)`.

- [ ] Write Node tests using literal comment fixtures for detached snapshots, circular and BigInt values, all requested summary paths, absent-value display, and oldest-first eviction at 100 entries.
- [ ] Run `npm test` and verify failure because `probe-core.js` does not exist.
- [ ] Implement the smallest dependency-free UMD core that satisfies the tests.
- [ ] Run `npm test` and verify all tests pass.

### Task 2: OneSDK adapter and probe screen

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `script.js`
- Create: `tests/browser-fixture.html`

**Interfaces:**
- Consumes: global `OneSDKProbeCore` and global `OneSDK`.
- Produces: `window.__oneSDKProbeLog`, newest summary/RAW display, Copy Logs, Clear Logs, and OneSDK subscription cleanup.

- [ ] Create a fake-OneSDK browser fixture first that provides a complete representative comment and requires the real adapter to render it.
- [ ] Implement semantic probe markup and a compact, readable diagnostic layout.
- [ ] Implement callback-boundary capture, Console output, capped log updates, safe rendering, copy fallback, clear behavior, initialization status, and idempotent `pagehide` disposal.
- [ ] Run JavaScript syntax checks and use the browser fixture to verify load, received fields, RAW JSON, Copy Logs, and Clear Logs.

### Task 3: OneComme metadata and research documentation

**Files:**
- Modify: `README.md`
- Modify: `research/anonymous-comment-notes.md`
- Create: `template.json`
- Create: `README.txt`

**Interfaces:**
- Produces: OneComme metadata, import/run instructions, privacy warning, and the six-case comparison worksheet.

- [ ] Add only the metadata and in-package instructions used by the known working NICO FLOW template; document manual ZIP contents without generating a ZIP.
- [ ] Document purpose, import, launch, RAW JSON, Copy/Clear, temporary status, privacy warning, and unverified real-device scope.
- [ ] Add the requested six-row comparison table and a place to record candidate JSON paths without drawing conclusions.
- [ ] Run the full verification set: `npm test`, syntax checks, DOM-ID contract check, `git diff --check`, forbidden-send/storage scan, capture-order inspection, `git diff --stat`, and `git status --short`.
