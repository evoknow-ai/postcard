# PostCard maintenance and release contract

The user requires every feature and previous bug fix to be checked before a new version is delivered. These instructions apply to all changes in this repository.

## Before changing code

- Read `docs/FEATURE-PRESERVATION.md`, `docs/REGRESSION-CHECKLIST.md`, and `docs/RELEASE-STATUS.md`.
- The complete recovered feature baseline is v0.9.11: local commit `e246e687a9b5c31ea8d6f51390a2f1fbc1ce13a1`, published equivalent `969c9a2ba9b5717da5ca6e737dfdd1b73f921434`, identical tree `faac719453da38ee3d6cdddbfa174bcda6384f58`. This is a feature baseline, not proof that every feature works. Older `main` omitted recovered features; do not replace this source with that branch.
- Review the actual current branch and diff. Preserve unrelated fixes, UI controls, source-tab context, audio metadata, bundled models and WASM.

## During a fix

- Add or extend a permanent case in `docs/qa/catalog.json` for every new feature or bug. Record the original symptom, repeatable steps and expected behavior.
- Add a behavioral automated regression test where practical. Tests must use real entry points, and window tests must include simultaneous launches and service-worker restart.
- Existing unfinished cases remain unfinished. Never delete a failing case, weaken its expected behavior, or silently retire a feature to get a release through.
- Do not close existing duplicate windows automatically: they may contain unsaved drafts.

## Before distributing any new version

- Run `node scripts/release-check.cjs --automated`. It checks the test suite, syntax, labels, catalog references and required assets. A green result here proves only automated checks.
- Create current-candidate evidence using `--init-evidence`; execute every checklist case in real Chrome or through a supported browser surface that can exercise the extension. Record OS/Chrome version, tester, date, source fingerprint, and evidence per case.
- Use a candidate ZIP for QA only; never describe an unverified package as ready/fixed. Record and test the exact ZIP SHA-256. Compare the candidate manifest version with the actual published store version.
- Run `node scripts/release-check.cjs --release --evidence docs/qa/evidence.json --package /absolute/path/candidate.zip --report` and require exit 0 / READY before release distribution.
- FAIL, BLOCKED, NOT TESTED, stale evidence, version mismatch, and missing artifact verification all block release. If browser/media access is unavailable, complete source/test work, report the limitation, and deliver the checklist/status instead of another release ZIP. Do not ask the user to waive this rule unless they explicitly request an unverified candidate.
- Any code change requires fresh evidence for the resulting source. Never copy old PASS results to a changed candidate without rerunning the cases.
- Do not infer successful playback, camera capture, audio duration, UI layout, social insertion or window behavior from mocked API tests. Keep automated coverage and browser evidence separate.
- No actual social posts, messages or paid provider calls without explicit authorization; use disposable drafts, mock providers and test adapters.

## Delivery

Report source changes, automatic results, browser results, unresolved defects and release status honestly. Keep instructions and test inventory in git. Do not create a new version merely to ship process documents or an unverified patch.
