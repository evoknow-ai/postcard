# PostCard feature and regression checklist

Every row is required before distributing a new version. A passing unit/API test is partial coverage, not a verified browser feature. Results must be PASS, FAIL, BLOCKED or NOT TESTED; the last three block release.

There are **62 cases**, including previous regressions. The canonical editable inventory is [catalog.json](qa/catalog.json). Run `node scripts/release-check.cjs --report` to regenerate this list and the status report.

## Test setup

Use a disposable Chrome profile with the candidate extension. Record OS, Chrome version, extension version, source fingerprint and candidate ZIP SHA-256. Use two slides with distinct text, a pasted screenshot, a table, a multi-frame GIF, rotated text, two narration recordings and an MP3 longer than the slide. Keep one editor and one supported social draft open. Test both a clean profile and an upgrade with existing saved content.

Record each result with tester, date and specific evidence (screenshot, video playback/duration result, console log, or precise observed steps). Use mocked providers/social adapters for posting tests; do not send real posts or incur API charges without explicit authorization.

## Feature checks

| ID | Feature | Repeatable check | Required result | Automated coverage | Chrome result |
|---|---|---|---|---|---|
| WIN-01 | Repeated toolbar launches | Click the extension 20 times, including rapid clicks. | Exactly one editor workspace; no blank New Tab window. | Partial: `tests/windows.test.cjs` | NOT TESTED |
| WIN-02 | Preserve open draft and Slides | Edit text without leaving; reopen via toolbar, then repeat while in Slides. | Focus existing workspace without reload, lost edits, or extra window. | Partial: `tests/windows.test.cjs` | NOT TESTED |
| WIN-03 | Worker restart and minimized window | Minimize editor; stop extension service worker in DevTools; click toolbar. | Existing window is restored and focused; no duplicate. | Partial: `tests/windows.test.cjs` | NOT TESTED |
| WIN-04 | Close and reopen; failed launch | Close editor and reopen; use mocked query/create failures. | One replacement after closing; failures do not multiply windows; retry succeeds. | Partial: `tests/windows.test.cjs` | NOT TESTED |
| WIN-05 | Settings reuse | Open Settings repeatedly while editor stays open. | One Settings window, separate from one editor. | Partial: `tests/windows.test.cjs` | NOT TESTED |
| WIN-06 | Recorder return | Go Editor → Recorder → Back to editor ten times; test a failed editor open. | At most one editor and one recorder; no blank windows; recorder stays open on failed return. | Partial: `tests/windows.test.cjs` | NOT TESTED |
| WIN-07 | Social source survives Slides | Launch from a composer, enter Slides, edit and return, then insert a card. | Insertion targets the originating browser window; navigation preserves source IDs. | Partial: `tests/startup.test.cjs` | NOT TESTED |
| WIN-08 | Context menu selection | Right-click selected page text with editor closed, then already open. | Selection can be used to create a card without duplicate windows or silently losing a draft. | None yet | NOT TESTED |
| TXT-01 | Create and edit | Add two text blocks; double-click and type multiline text. | Both blocks stay independently editable; caret and selection work. | Partial: `tests/startup.test.cjs` | NOT TESTED |
| TXT-02 | Drag and deselect | Select/drag text, click empty canvas, then drag again. | Text moves; blank-canvas click clears selection; editing does not unexpectedly drag. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| TXT-03 | Resize and orientation | Resize at 0°, 45°, 90°, 180°, 270°; use dial, numeric entry and snapping. | Orientation controls exist; common angles snap; resize follows the rotated axes. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| TXT-04 | Text formatting | Change font, size, color, bold, italic, alignment, width, line height and shadow. | Canvas and exported image agree for each selected block. | None yet | NOT TESTED |
| TXT-05 | Multilingual fonts and emoji | Enter Bangla, Arabic, Japanese, Chinese and emoji; change Google Font; export PNG. | Text remains legible and matches the editor; missing fonts report/fall back sensibly. | None yet | NOT TESTED |
| OBJ-01 | Image clipboard and file import | Paste a screenshot; insert an image file; add a second image. | Each image appears as an independently selectable object. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| OBJ-02 | Image movement and resize | Drag and resize images from all four corners in every card format. | Aspect ratio and opposite anchor remain correct; other objects do not move. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| OBJ-03 | Layer ordering | Overlap text, image and table; move each forward/back and select covered objects. | All types share the same order in editor and export; text remains reachable. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| OBJ-04 | Copy, cut, paste and duplicate | Copy/cut/paste/duplicate each object type; use keyboard and available buttons. | Independent copies with unique IDs; native text selection clipboard still works. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| OBJ-05 | Delete selection | Delete text/image/table using trash, Delete, Backspace and cut; type Backspace inside text. | Only selected object is removed; editing Backspace deletes characters. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| OBJ-06 | Undo and redo | Add, move, resize, rotate, reorder, delete, then undo and redo repeatedly. | Content, geometry and layer order restore without mutating neighboring slides. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| TBL-01 | Table editing and formatting | Add a table; edit cells; change template/header/font/borders/colors; drag and resize. | Cells stay editable and all styles/geometry survive export and reopen. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| BG-01 | Solid and gradients | Use solid, preset and custom gradients; switch formats; reopen. | Background renders consistently on canvas, PNG and Slides. | None yet | NOT TESTED |
| BG-02 | Image framing | Upload a background; test Cover/Contain/Actual, darkness and panning. | Framing is preserved in editor, exported card and Slides. | None yet | NOT TESTED |
| BG-03 | Giphy and Featured | Search and select Giphy/Featured media; simulate network failure. | Results apply correctly; failures show useful errors without breaking the editor. | None yet | NOT TESTED |
| BG-04 | Animated GIF background and object | Use a GIF with visibly different frames as background and as an image object. | Video contains multiple frames, correct loop timing and ordered overlays. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| SLD-01 | Add and edit blank slide | Create two slides; use +; Edit slide; add text; Back to Slides; reopen. | The new slide is editable and its edits persist; neighbors remain unchanged. | Partial: `tests/startup.test.cjs` | NOT TESTED |
| SLD-02 | Duplicate, reorder and delete | Duplicate a slide, move it, delete another, then edit the duplicate. | Stable slide IDs target the intended slide; remaining content stays intact. | Partial: `tests/startup.test.cjs` | NOT TESTED |
| SLD-03 | Thumbnail navigation | Use thumbnails, previous/next, drag reorder, Earlier/Later and preview. | Selection, index, preview, thumbnail and editor agree. | None yet | NOT TESTED |
| SLD-04 | Duration persistence | Set distinct durations including 120 seconds; edit via both navigation routes. | Durations never reset to 3 seconds and totals stay correct. | Partial: `tests/startup.test.cjs` | NOT TESTED |
| SLD-05 | Narration per slide | Record narration on two slides; play/pause/delete one recording; edit and reorder slides. | Narration stays associated with the correct slide and voice levels persist. | Partial: `tests/startup.test.cjs` | NOT TESTED |
| SLD-06 | Music across slideshow | Add MP3; play/pause/stop/remove; set voice and music volumes separately. | One music track spans slides and both volume controls affect export. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| SLD-07 | Full music duration | Use one 3-second slide and a longer music track; export with option off and on. | Off uses configured duration; on includes full track by extending last slide; narration preserved. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| SLD-08 | Ten-minute limit | Set duration to just below, at and above 600 seconds; add/reorder slides. | Limit is applied consistently; no Free/Pro gate or hardcoded activation key. | None yet | NOT TESTED |
| SLD-09 | Reload and slow/failed storage | Save/reopen deck; throttle/fail storage in test harness; return immediately after editing. | Save completes before navigation; failures keep editor open and never save empty startup state. | Partial: `tests/startup.test.cjs` | NOT TESTED |
| EXP-01 | PNG fidelity | Export all three formats with rotated text, image, table and background. | Dimensions, colors, fonts, geometry and stacking match the visible card. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| EXP-02 | Animated card MP4 | Apply text entrance and background pan/zoom; export with chosen duration. | Actual playable MP4 contains motion and matches requested duration. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| EXP-03 | Slideshow MP4 | Export multiple slides with GIF, text motion, narration and music. | Real MP4 plays with correct order, timing, dimensions, audio and transitions. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| EXP-04 | Export progress and long audio | Export a long one-slide audio video; observe modal, percentage, completion and failure. | Progress remains visible and responsive; completion occurs only after output is ready. | Partial: `tests/startup.test.cjs` | NOT TESTED |
| EXP-05 | Origin-clean and encoder errors | Use remote GIF/image; simulate fetch failure and unavailable MP4 encoder. | No captureStream tainted-canvas crash; errors are visible; WebM never mislabeled as MP4. | Partial: `tests/image-objects.test.cjs` | NOT TESTED |
| CAM-01 | Camera and microphone devices | Start/stop camera; choose camera/mic; deny permission; remove device; close recorder. | Useful errors; selections persist; all media tracks stop when stopped/closed. | None yet | NOT TESTED |
| CAM-02 | Record, stop, retake and download | Record voice and overlay; stop, play, retake and download. | Playable file includes intended microphone audio; repeated cycles remain usable. | None yet | NOT TESTED |
| CAM-03 | Framing and mirror | Verify default Cover; test Contain/Actual, zoom 1–3×, wheel zoom, pan, mirror and reset. | Framing is correct in preview and recorded output; reset works. | None yet | NOT TESTED |
| CAM-04 | Overlay text and independent drag | Change overlay/font size/color; drag text; pan camera elsewhere. | Text hit target wins; video pan does not steal text drag; recording includes overlay. | None yet | NOT TESTED |
| CAM-05 | Background None/Blur/Color/Image | Try all modes while moving head/shoulders and wearing headphones; record each. | Person stays sharp; no major halo, skin bleed, beard artifact or heavy ghost trail. | None yet | NOT TESTED |
| CAM-06 | Bundled model and WASM startup | Load unpacked with network offline for model assets; start all background modes. | Local model/WASM assets load under MV3 CSP; no missing helper crash. | None yet | NOT TESTED |
| SOC-01 | X/Twitter composer | Use a disposable draft on X/Twitter; insert PNG and caption; verify video where offered; do not publish. | Correct supported composer receives media/caption; unsupported state has clear error; source draft remains intact. | None yet | NOT TESTED |
| SOC-02 | Facebook composer | Use a disposable draft on Facebook; insert PNG and caption; verify video where offered; do not publish. | Correct supported composer receives media/caption; unsupported state has clear error; source draft remains intact. | None yet | NOT TESTED |
| SOC-03 | Instagram composer | Use a disposable draft on Instagram; insert PNG and caption; verify video where offered; do not publish. | Correct supported composer receives media/caption; unsupported state has clear error; source draft remains intact. | None yet | NOT TESTED |
| SOC-04 | LinkedIn composer | Use a disposable draft on LinkedIn; insert PNG and caption; verify video where offered; do not publish. | Correct supported composer receives media/caption; unsupported state has clear error; source draft remains intact. | None yet | NOT TESTED |
| SOC-05 | Reddit composer | Use a disposable draft on Reddit; insert PNG and caption; verify video where offered; do not publish. | Correct supported composer receives media/caption; unsupported state has clear error; source draft remains intact. | None yet | NOT TESTED |
| SOC-06 | Bluesky composer | Use a disposable draft on Bluesky; insert PNG and caption; verify video where offered; do not publish. | Correct supported composer receives media/caption; unsupported state has clear error; source draft remains intact. | None yet | NOT TESTED |
| AI-01 | Provider, model and key settings | Switch OpenAI/Anthropic, preset/custom model; save and reopen; show/hide key. | Settings persist and selected model is used; key is not exposed in logs. | None yet | NOT TESTED |
| AI-02 | AI generation and errors | Use mocked provider responses and errors for Test AI. | JSON is parsed; card/caption lengths handled; errors are readable; no post is submitted. | None yet | NOT TESTED |
| AI-03 | Scheduling and deduplication | Use a fake clock with recurring/one-time schedules, days, AM/PM and disabled state. | Correct local-time execution once per scheduled slot; one-time disables after run. | None yet | NOT TESTED |
| AI-04 | Run/post and history | Use a mocked social adapter to run success/failure, retry and history clear. | History accurately reports outcomes; no real post or paid API call without explicit authorization. | None yet | NOT TESTED |
| STATE-01 | Restart and upgrade existing state | Load a pre-change saved deck with images, tables, rotation and audio; close/reopen Chrome. | Existing project survives with all content/settings and unique object/slide IDs. | Partial: `tests/startup.test.cjs`, `tests/image-objects.test.cjs` | NOT TESTED |
| UI-01 | Layout and button spacing | Inspect editor, Slides, recorder and dialogs at normal size, smaller window and 200% zoom. | Controls remain visible, usable and separated; no touching export buttons. | None yet | NOT TESTED |
| UI-02 | Keyboard and focus | Use Tab, Enter, Escape, copy/paste, Delete and rotation arrow keys across dialogs/editor. | Focus and shortcuts operate the intended control without accidental deletion. | None yet | NOT TESTED |
| REL-01 | Version consistency | Compare manifest, popup, editor footer, credits and Settings; compare with published store version. | All labels match candidate version, which is greater than store version. | None yet | NOT TESTED |
| REL-02 | Feature baseline and complete assets | Review diff against previous delivered feature baseline; inspect script references and local assets. | No recovered feature or bundled asset disappears; do not start from stale main. | None yet | NOT TESTED |
| REL-03 | Privacy and permissions | Inspect manifest/Privacy link and key storage; review any permission changes. | Policy link works; declared data handling matches behavior; no unexplained permission expansion. | None yet | NOT TESTED |
| REL-04 | Exact release package smoke | Install final ZIP unpacked in a disposable Chrome profile; repeat window/slide/export smoke. | Correct version loads with no extension errors; record exact ZIP SHA-256 and source fingerprint. | None yet | NOT TESTED |
| REL-05 | Historical promise audit | Compare README feature history with UI: especially old JPG/WebP downloads and each social adapter. | Any missing previously promised capability is recorded as a defect or explicitly retired, never silently dropped. | None yet | NOT TESTED |

## Permanent bug register

- **WIN-01** — Duplicate PostCard Editor / New Tab windows reported September 11.
- **WIN-06** — Duplicate recorder tabs and focus handoff were fixed in v0.8.3–v0.8.7.
- **WIN-07** — Source tab/window parameters were discarded during editor/Slides navigation.
- **TXT-02** — Text movement and clicking-away deselection regressions.
- **TXT-03** — Rotation dial vanished; rotated resize broke.
- **OBJ-01** — Missing image copy/paste support.
- **OBJ-03** — Pasted image blocked text; foreground/background controls missing.
- **OBJ-05** — Deletion controls and text selection regressions.
- **BG-04** — GIF export froze on first frame.
- **SLD-01** — New slides could not be edited; Back to Slides disappeared.
- **SLD-02** — Slides overwrote the wrong slide.
- **SLD-04** — Long slide/music clipped to 3 seconds.
- **SLD-05** — Per-slide recording controls disappeared; metadata must survive editing.
- **SLD-06** — Slideshow music and volume controls disappeared.
- **SLD-07** — Long music was truncated; full-length option required.
- **EXP-02** — Animated card MP4 support disappeared.
- **EXP-03** — Slideshow video export and audio features disappeared.
- **EXP-04** — Progress dialog disappeared; long audio progress appeared stalled.
- **EXP-05** — captureStream origin-clean failures; export duration/format mismatches.
- **CAM-03** — Cover default and framing helpers were restored previously.
- **CAM-04** — Overlay text dragging repeatedly broke.
- **CAM-05** — Segmentation mask, halo, color-bleed and jaw artifacts were repaired in v0.8.x.
- **CAM-06** — MediaPipe loading, missing stopSegmentationProcessor/currentVideoRect regressions.
- **UI-01** — Export dialog buttons touched; controls repeatedly disappeared.
- **REL-01** — Manifest was lower than published 0.9.9; UI version labels were stale.
- **REL-02** — Older main branch erased rotation, motion and audio features.

## Release commands

1. Run `node scripts/release-check.cjs --automated` during development. This never means a release is approved.
2. Run `node scripts/release-check.cjs --init-evidence` once for a new candidate. Preserve old evidence when creating a new candidate.
3. Complete every case against that source and the exact candidate ZIP; fill `docs/qa/evidence.json`. An agent must never invent browser results.
4. Run `node scripts/release-check.cjs --release --evidence docs/qa/evidence.json --package /absolute/path/candidate.zip --report`. Exit 0 means all recorded gates passed; exit 1 means automatic checks failed; exit 2 means evidence/release checks are incomplete.
5. Only after READY may the exact tested ZIP be presented as a new release. Any code change invalidates old evidence.

See [RELEASE-STATUS.md](RELEASE-STATUS.md) for the current candidate.
