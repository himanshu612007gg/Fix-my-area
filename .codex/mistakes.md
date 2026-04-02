# Mistakes Log

> This file is read at the start of every task and before every major decision.
> Each entry is a permanent lesson. Do not delete entries.

## Mistake: Build command used PowerShell npm shim
- **Date**: 2026-03-31T16:42:00+05:30
- **Step**: Step 5 - Verify the implementation and capture results
- **What happened**: Running `npm run build` failed before the build started because PowerShell execution policy blocked `npm.ps1`.
- **Root cause**: The environment resolves `npm` to the PowerShell shim instead of `npm.cmd`.
- **Impact**: Verification had to be retried with a different command.
- **Fix applied**: Re-ran the command as `npm.cmd run build`.
- **Prevention rule**: On this Windows setup, prefer `npm.cmd` over `npm` when invoking npm scripts from PowerShell.

---

## Mistake: Next.js inferred the wrong workspace root
- **Date**: 2026-03-31T16:47:00+05:30
- **Step**: Step 5 - Verify the implementation and capture results
- **What happened**: The first Next build failed because Turbopack tried to read `C:\Users\LENOVO` and hit an access-denied error outside the project.
- **Root cause**: Next.js inferred a parent workspace root because of multiple lockfiles on the machine, and the previous config did not pin the project root.
- **Impact**: Build verification was blocked until the config was corrected.
- **Fix applied**: Updated `next.config.mjs` to set `outputFileTracingRoot` and `turbopack.root` to the project directory.
- **Prevention rule**: When a repo sits inside a larger folder tree with multiple lockfiles, explicitly configure the Next.js project root before relying on build output.

---

## Mistake: Firebase SDK install timed out
- **Date**: 2026-03-31T18:52:00+05:30
- **Step**: Firebase follow-up - add Firebase authentication
- **What happened**: Installing the `firebase` npm package did not complete inside the available execution window.
- **Root cause**: Network package installation was too slow or blocked in this environment.
- **Impact**: The planned npm-based Firebase SDK integration could not be completed directly.
- **Fix applied**: Switched to loading the official Firebase web SDK from Google's hosted scripts at runtime.
- **Prevention rule**: When package installation stalls in this environment, prefer a browser-loaded official SDK if the feature only needs client-side runtime access.

---
