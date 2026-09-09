# PostCard

PostCard is a Chrome extension that creates shareable text cards and inserts the generated PNG directly into a social-media post.

**Powered by [MyPoint.Cards](https://mypoint.cards/)**

## MVP

- Card editor with text, background color, text color, font size, alignment, shadow, and three social-friendly sizes.
- PNG generation entirely in the browser.
- Insert PNG into the active composer on:
  - X / Twitter
  - LinkedIn
  - Facebook
  - Reddit
  - Bluesky
- Optional post text insertion.
- Right-click selected text → **Create PostCard from selection**.
- Download PNG fallback.
- No server and no account required.

## Install locally

1. Download/unzip this repository.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this directory.
6. Open a supported social network, start a new post, then click the PostCard extension.

## v0.1.1

- Close the extension popup automatically after a successful social-media insert so the attached card is immediately visible in the composer.

## Important note about social-media uploaders

Social networks change their DOM frequently. PostCard uses site adapters in `content.js` to find the active composer and file input. If a network changes its markup, update only that adapter's selectors.

Some sites do not create their `<input type="file">` until the user clicks the site's native photo/media button. If PostCard says it cannot find an uploader, click the site's media/photo control once and press **Insert into Post** again.

## Architecture

- `popup.html / popup.js / popup.css` — card editor and renderer.
- `content.js` — site adapters and image injection.
- `background.js` — context-menu integration.
- `manifest.json` — Manifest V3 configuration.

## Next release

- Native PostCard button injected into each site's composer.
- Templates, gradients, image backgrounds, emoji and Giphy.
- Import more of the MyPoint.Cards editor features.
- Per-network recommended aspect ratio.
- Recent cards and reusable presets.
- Better uploader adapters and automated compatibility tests.

## License

MIT

## v0.2.0

- Rebuilt the editor around the MyPoint.Cards feature set.
- Added font family, font color, line height, text shadow and optional branding.
- Added solid colors, preset gradients and custom gradients.
- Added emoji insertion.
- Added Giphy search.
- Added image upload with contain/cover/actual-size, darkness and dragging.
- Added Featured image search from featured.mypoint.cards.
- Added draggable text positioning.
- Added PNG/WebP/JPG downloads.
- Fixed card placeholder behavior: the preview is blank until the user types; it never remains behind user text.
- Successful social insertion still closes the extension popup automatically.

## v0.2.1

- Fixed Chrome popup width so the preview no longer gets clipped on the right.
- Reduced the popup to 790px and made both columns `min-width: 0`.
- Preview canvas now always scales to the available column width.

## v0.3.0

- Larger desktop-oriented preview workspace.
- Removed the card-text textarea.
- Direct editing on the preview with contenteditable text blocks.
- Multiple independent text blocks per card.
- Per-block font, size, color, line height, alignment, bold, italic, shadow, width and position.
- Add/Delete Text controls.
- Multi-line text supported inside every block.
- Social insertion/export renders all text blocks into one image.

## v0.4.0 — Canvas-first editor

PostCard has been reimagined as a desktop rich-canvas editor.

- Clicking the extension opens a dedicated 1180×820 editor window instead of a cramped Chrome popup.
- The canvas is now the center of the product.
- Text is created, selected, edited and deleted directly on the canvas.
- Toolbar buttons open contextual popovers for font, size, alignment, color, background, image, emoji, card format and advanced text settings.
- Landscape / Square / Portrait are toolbar actions.
- Download and Insert into Post are toolbar actions.
- Multiple independent text blocks remain supported.
- Text blocks can be duplicated and deleted.
- Keyboard shortcuts: Cmd/Ctrl+B, Cmd/Ctrl+I, Cmd/Ctrl+D, Delete.
- After Insert into Post, the editor focuses the social tab and closes.

## v0.4.1

- Fixed direct mouse dragging for text blocks: click-and-drag anywhere on selected text to reposition it; a normal click still edits text.
- Fixed Emoji menu insertion. Emoji now inserts into the selected text block at the last caret position when possible.


## v0.4.2

- Added direct text resizing from the canvas.
- Selected text blocks show a blue resize handle on the lower-right corner.
- Dragging the handle scales font size and text box width together.
- Existing click-to-edit and drag-to-move behavior remains intact.


## v0.5.0
- Expanded Google Fonts: Latin, Bangla, Chinese, Japanese, Korean, and Arabic families.
- Added editable 2x2, 3x3, and 4x4 tables on the canvas.
- Restored animated Giphy backgrounds/search.
- Added Slides with add/duplicate/delete and per-slide duration.
- Added Video export using the browser recorder. MP4 is used when the browser exposes H.264/MP4 MediaRecorder; otherwise it falls back to WebM. A bundled FFmpeg.wasm MP4 encoder is planned for the next package.

## v0.6.0

- Reworked the editor into a three-pane canvas-first layout: tool rail, canvas, and contextual inspector.
- Removed toolbar overflow that caused Duplicate/Delete/More controls to be clipped.
- Added **New** to start a clean session.
- GIF backgrounds are now decoded frame-by-frame during video rendering with `ImageDecoder`, so exported video preserves GIF animation instead of freezing on the first frame.
- Kept Slides, Tables, multilingual Google Fonts, direct text editing, drag/resize, Download, and social insertion.

## v0.6.1

- Fixed Backdrop color swatches so each solid color displays correctly.
- Fixed gradient swatches so every gradient preview is visible.
- Removed the two non-functional undo/redo toolbar buttons.

## v0.6.2

- Featured and GIF search thumbnails now use native lazy loading and asynchronous decoding.
- Added a Credits page/dialog for PostCard, Google Fonts, GIPHY, featured image sources, browser APIs, and licensing.
- Editor window now opens centered on the primary display.
- PostCard now persists the complete editor session in `chrome.storage.local`, including canvas content, text blocks, tables, slides, background, caption, selected format, and other editor state.
- Reopening PostCard from another tab restores the same working session.
- **New** clears the saved session and starts fresh.

## v0.6.3

- Fixed fatal `Unexpected end of input` JavaScript syntax error introduced in v0.6.2.
- Repaired persistent-state save/restore initialization.
- Kept centered editor window, lazy-loaded image thumbnails, Credits dialog, and cross-tab session persistence.

## v0.6.4

- Rebuilt table interaction. Cells are directly editable.
- Selected tables show a move handle and resize handle.
- Tables can be moved and resized on the canvas.
- Duplicate/Delete now work for selected tables.
- Tables are included in PNG/video export with their edited cell contents and current size.

## v0.6.5

- Fixed direct table-cell editing; selecting/focusing a cell no longer re-renders and destroys the active editable DOM node.
- Table selection now exposes the same Font, Size, Bold, Italic, Alignment, and Color inspector controls used by text.
- Table typography is persisted and included in image/video export.
- Table move and resize controls remain available while cells are editable.

## v0.6.6

- Table cells are directly editable and keep focus while typing.
- Tables can be deleted with the right-side Delete button or Delete key.
- Table font face, size, text color and alignment now work.
- Table inspector adds border size 0–20px, background color, first-row header toggle, and modern templates.
- Templates: Clean, Midnight, Ocean, Emerald, Sunset, Slate, Glass.
- Table appearance is preserved in saved state and exports.

## v0.6.7

- Fixed image download/export regression where canvas text blocks were omitted when table export was added.
- PNG download and social insertion now include text blocks and tables together.
- Video export uses the same corrected canvas renderer.

## v0.6.8

- Added unlimited undo/redo history for the lifetime of the editor session.
- Added visible Undo and Redo buttons.
- Keyboard shortcuts:
  - Cmd/Ctrl+Z — Undo
  - Cmd/Ctrl+Shift+Z — Redo
  - Ctrl+Y — Redo
  - Cmd/Ctrl+C — Copy selected text/table object
  - Cmd/Ctrl+V — Paste selected object
  - Cmd/Ctrl+S — Download
- Native copy/paste remains available while directly editing text, table cells, or input fields.

## v0.6.9

- Moved Credits out of the top toolbar.
- Footer now shows Credits · version · MIT License.
- Credits opens a dedicated branded card inspired by the TabPocket credits presentation.
- Credit: “Imagined by Mohammed Kabir” / “Developed by his agents.”
- Added links to Kabir's website, Changelog, and GitHub.

## v0.6.10

- Fixed regression where text blocks could no longer be dragged with the mouse.
- Text blocks now use pointer capture for reliable dragging even though they are contenteditable.
- A normal click still enters direct text editing at the clicked caret position.
- Resize handle behavior remains unchanged.

## v0.6.11

- Removed the redundant Font → Font two-level menu.
- Font selection is now a direct dropdown in the right inspector.
- Remembers the user's last selected font in Chrome local storage.
- New text blocks inherit the remembered font.
- Table font changes also update the remembered font preference.

## v0.6.12

- Removed the non-functional Design tab.
- Removed the redundant Ready status from the header.
- Insert into post is enabled only when X/Twitter, Facebook, Instagram, or LinkedIn is open.
- Otherwise Insert into post is disabled with an explanatory tooltip.

## v0.6.13

- Fixed Insert into post availability: it now checks only the active browser tab.
- Having X/Facebook/Instagram/LinkedIn open in another tab no longer enables the button while the user is browsing an unsupported site such as GitHub.

## v0.6.14

- Fixed Portrait 4:5 canvas layout.
- Portrait and Square are now constrained by available vertical editor space instead of overflowing below the window.
- Editor center pane can scroll vertically when the browser window is too short.
- Landscape remains width-oriented.

## v0.7.0 — AI Automation

- Added a Settings cog that opens a dedicated AI Automation configuration page.
- Supports OpenAI Responses API and Anthropic/Claude Messages API with locally stored API keys.
- Configurable model and prompt/topic instructions.
- Recurring schedules: choose Mon–Sun plus 15-minute time intervals using 12-hour AM/PM controls.
- One-time schedule using a date/time picker.
- Destinations: X, Facebook, or Instagram.
- Scheduled workflow generates both social caption and PostCard headline, renders a PNG using the current PostCard visual design, opens the destination, attaches the image and caption, and clicks Post/Share.
- Added Test AI and Run & Post Now controls.
- Added execution history with success/failure details.
- Chrome alarm scheduler runs while Chrome is available.

## v0.7.1

- Fixed footer text overlap between restore/status messages and Credits/version/license.
- AI model selection is now a provider-specific dropdown instead of a single hard-coded model.
- OpenAI choices include GPT-5.6 Luna, Terra, Sol, GPT-5.5, GPT-5.4, GPT-5.4 Mini and Nano.
- Claude choices include Sonnet 4.5, Opus 4.1 and Haiku, plus a Custom model ID option.
- Recurring schedule now uses one clear 15-minute time dropdown.
- Schedule shows the browser's local timezone and a human-readable summary such as “Posts Mon, Tue, Wed at 9:15 AM”.
- One-time scheduling explicitly shows date/time and timezone.

## v0.7.2

- Fixed Insert into post from the standalone PostCard editor window.
- PostCard now remembers the browser window/tab it was launched from instead of treating the editor popup as the active browser tab.
- Insert availability tracks the active tab in the originating browser window.
- On development extension reloads, PostCard injects its content script into an already-open supported social page on demand, so X does not need to be reloaded just to make Insert work.
- After insertion, PostCard focuses the social tab and closes the editor.

## v0.8.0 — Webcam video

- Added a **Video** tool in the left editor rail.
- Record webcam video directly inside PostCard.
- Optional microphone audio.
- Live text overlay with top/center/bottom position, font size and color.
- Overlay text is burned into the actual recorded video.
- 60-second recording limit to keep browser-based sharing practical.
- Download recorded video locally.
- Insert recorded video directly into supported social-media composers.
- Existing top Video action renamed **Export video** to distinguish slideshow export from webcam recording.

## v0.8.1

- Fixed webcam startup when a microphone is unavailable.
- Camera and microphone are now requested separately, so a missing audio device no longer blocks video.
- Added Camera and Microphone device selectors.
- Device list refreshes after permission is granted so actual device names appear.
- Improved errors for permission denied, no camera found, and camera busy/in use.

## v0.8.2

- Webcam recording now opens in a dedicated extension tab instead of the PostCard popup window.
- This gives Chrome a normal page context for camera/microphone permission prompting and device enumeration.
- Dedicated recorder includes camera/microphone selectors, overlay text, recording, download, and direct social insertion.
- If Chrome still sees no camera, the recorder gives explicit Chrome/macOS permission guidance.

## v0.8.3

- Fixed duplicate webcam recorder tabs.
- Clicking Video now reuses and focuses the existing PostCard recorder tab.
- If the originating social tab changes, the recorder tab is updated instead of another recorder being opened.
- Camera/microphone device list refreshes when returning to the recorder tab.

## v0.8.4

- Fixed Video recorder focus handoff.
- Clicking Video now activates the recorder tab, focuses its browser window, and closes the PostCard editor popup.
- This prevents the recorder from sitting behind the editor and gives `getUserMedia()` a focused document for camera permission/capture.
- Added a Back to editor button that reopens the PostCard editor after recording.
- Camera startup now explicitly waits for recorder focus before requesting media.

## v0.8.5

- Reworked webcam capture again to avoid the `chrome-extension://` top-level camera-device problem seen on Chrome/macOS.
- Clicking Video now opens the recorder as an extension iframe inside the active supported social-media tab.
- The iframe explicitly declares `allow="camera; microphone"` so the browser can grant media access in a normal tab context.
- The PostCard editor closes after handoff; Back to editor removes the recorder overlay and reopens the editor.
- Recorder assets are declared as web-accessible resources for HTTPS pages.

## v0.8.6

- Replaced the extension-page webcam recorder with a recorder that runs directly on `https://mypoint.cards/`.
- This uses a normal HTTPS origin for `getUserMedia()`, which is the most reliable Chrome/macOS camera-permission path.
- Video no longer requires X/Facebook/Instagram/LinkedIn to be the active tab just to start the camera.
- Recorded video can still be relayed back to the original supported social tab for insertion.
- Added `mypoint.cards` host permissions and content-script support.

## v0.8.7

- Removed the dependency on `mypoint.cards` for webcam recording.
- Video recorder runs entirely inside the Chrome extension.
- Clicking Video opens/reuses a dedicated PostCard recorder tab and closes the editor popup.
- Camera and microphone are accessed directly with `getUserMedia()` from the extension recorder.
- Recorded video can still be inserted directly into the original supported social-media tab.
- Removed `mypoint.cards` host permissions and recorder injection code.

## v0.8.8

- Start Camera is now a true toggle: once the webcam is active the same button becomes **Stop camera**.
- Stopping the camera immediately stops all webcam/microphone MediaStream tracks and turns the device off.
- Overlay text is now directly draggable with the mouse/pointer on the video preview.
- Removed the fixed Top/Center/Bottom overlay-position control; the text position is free-form.
- The dragged overlay coordinates are baked into the recorded video.
- Camera and microphone selections are preserved when the device list refreshes.

## v0.8.9

- Start Camera now toggles to Stop camera while active.
- Clicking Stop camera immediately stops all webcam/microphone tracks.
- Overlay text can be dragged freely with the mouse on the video preview.
- The dragged overlay position is burned into the recorded video.

## v0.8.10

- Added webcam framing controls.
- Zoom from 1.0× to 3.0×.
- Drag the video itself to pan/reposition the camera image.
- Mouse wheel over the preview adjusts zoom.
- Fit modes: Cover, Contain, Actual.
- Mirror camera toggle.
- Reset framing button.
- Text overlay remains independently draggable.
- Camera framing and overlay position are burned into the recording.

## v0.8.11

- Fixed text-overlay dragging by replacing conflicting canvas pointer handlers with one unified drag controller.
- Clicking/dragging directly on overlay text now moves only the text.
- Dragging elsewhere on the active video pans the camera framing.
- Fixed the “Choose a camera and click Start camera.” hint remaining visible after camera startup.
- Improved mouse cursor feedback for text dragging vs. video panning.

## v0.8.12
- Fixed video overlay text dragging with one authoritative pointer controller.
- Text uses exact rendered bounds for hit-testing and always has priority over video panning.
- Dragging preserves the initial mouse-to-text offset so text does not jump.

## v0.8.13
- Removed the redundant Overlay position helper.
- Font size now uses a live 20–140 px slider.
- True background-only blur/replacement is not faked in this build; it needs person segmentation so only the background is changed.

## v0.8.14

- Added Background effects to webcam recording: None / Blur / Replace with image.
- Uses Chrome/platform background segmentation masks when the camera/browser exposes them.
- Blur strength is adjustable and only the background is blurred; the person stays sharp.
- Background image replacement supports local image upload and runs entirely in the browser.
- If segmentation masks are unavailable but native camera background blur is available, PostCard uses the native blur capability.
- Image replacement is automatically disabled when the browser/camera cannot provide a person-segmentation mask.
- No cloud video processing is used.

## v0.8.15

- Simplified webcam recorder UI.
- Moved Fit, Zoom, Mirror, Background and Reset into a compact toolbar under the video.
- Removed stacked Background/Video Framing cards and most explanatory text.
- Background blur now always works: uses browser segmentation when available, otherwise a local feathered portrait-mask fallback.
- Background image replacement also works with the same fallback when native segmentation is unavailable.

## v0.8.16

- Removed the redundant “Drag the video itself to reposition. Use the mouse wheel over the video to zoom.” helper text from the recorder UI.

## v0.8.17

- Rebuilt the webcam recorder layout from scratch to eliminate duplicated controls and stacked cards.
- Video controls now live only in one compact toolbar under the preview.
- Right panel is limited to camera, microphone, overlay text, font, color, and recording actions.
- Background menu now includes None, Blur, Color, and Image.
- Added solid-color virtual background support.
- Image background upload now immediately activates the image background.
- Improved non-segmentation fallback from a circular vignette to a broad feathered portrait matte.

## v0.8.18

- Replaced the fake portrait/vignette background effect with real MediaPipe Selfie Segmenter person segmentation.
- Bundles MediaPipe Tasks Vision JS + WASM and the selfie_segmenter.tflite model locally for Manifest V3.
- Background modes: None / Blur / Color / Image.
- Blur uses a per-pixel person confidence mask with feathered edges.
- Color and image replacement use the same person mask.
- Background processing remains local in the browser.

## v0.8.19

- Fixed the Start camera crash caused by a stale `stopSegmentationProcessor()` call.
- Added `wasm-unsafe-eval` to the extension CSP for bundled MediaPipe WASM.
- Removed competing MediaPipe/PostCard animation loops; background processing and text overlay now render in one frame loop.
- MediaPipe background rendering respects PostCard framing and mirror state.

## v0.8.20

- Fixed `currentVideoRect is not defined` after MediaPipe integration.
- Restored PostCard's camera framing calculation used by Cover / Contain / Actual, zoom, and pan.
- Restored the raw-camera canvas drawing helper used before MediaPipe initialization and as a safe fallback.

## v0.8.22

- Clean rebuild from the known-loading v0.8.20 base.
- Applies only the MediaPipe person-mask correction.
- Selfie Segmenter confidence mask index 1 is used for person segmentation when available.
- Avoids the broader v0.8.21 changes that caused extension load problems.

## v0.8.23

- Replaced confidence-mask compositing with MediaPipe CATEGORY_MASK output.
- Selfie Segmenter category 0 is background and category 1 is person.
- PostCard now builds a binary person alpha mask directly from category value 1.
- This removes ambiguity in confidence-mask ordering and prevents background objects from being preserved as foreground.
- Blur, Color and Image modes all use the same category-person mask.


## v0.8.24

- Replaced the modified MediaPipe integration with the BackgroundProcessor implementation supplied by the user.
- Segmentation now runs at the camera's native video dimensions on a dedicated offscreen processed canvas.
- PostCard framing, zoom, pan, mirror, and text overlay are applied only after MediaPipe finishes segmentation.
- This fixes the mask-coordinate mismatch that caused the subject to blur and background objects to leak through.
- Blur, Color, and Image modes all use the same processor path.

## v0.8.25

- Added mask cleanup to reduce MediaPipe false-positive background artifacts.
- Keeps the largest center-weighted person component instead of every pixel MediaPipe tentatively classifies as person.
- Removes detached furniture/cable/background blobs.
- Adds light morphology around the subject for cleaner shoulders and hair.
- Adds temporal mask smoothing to reduce flicker and edge popping.
- Blur, Color and Image all share the cleaned mask.


## v0.8.26

- Replaced the previous mask cleanup with the supplied BackgroundProcessor v2.
- Uses smoothstep confidence thresholding to remove the translucent halo around hair/headphones.
- Uses an eroded person mask for a tighter foreground cutout.
- Uses a dilated removal mask for background-only blur preparation.
- Removes the person before blurring and fills the hole with a pull-push mip pyramid, preventing shirt/skin color bleed into the blur.
- Adds light temporal EMA smoothing to reduce flicker without heavy motion trails.
- Caps blur at 24 px; the UI now matches that limit.


## v0.8.27

- Switched background segmentation to MediaPipe `selfie_multiclass_256x256.tflite`.
- Foreground is built from multiclass confidence masks:
  hair, body skin, face skin, clothes, and accessories.
- This improves hair/headphone/shoulder separation compared with the binary selfie model.
- Uses the maximum confidence across foreground classes to create one stable subject mask.
- Reduced temporal smoothing to 0.18 to lessen motion trails.
- Reduced edge feathering to 2 px for a cleaner cutout.
- Blur continues to remove the subject before blurring to prevent skin/shirt color bleed.


## v0.8.28

- Fixed the dark jaw/chin “fake beard” artifact seen with the multiclass model.
- Removed erosion from the visible person mask so jaw/neck pixels are not shaved away.
- Added class-aware confidence boosts for face skin and body skin.
- Reduced edge feathering from 2 px to 1 px.
- Reduced temporal smoothing from 0.18 to 0.08 to reduce facial-edge lag.
- Kept a generous dilated mask only for background removal before blur.

## v0.8.29

- Moved Slides from the top navigation into the editor's left tool rail.
- Removed the top-level Export video button.
- Added a dedicated PostCard Slides screen.
- New slide screen shows all slide previews in a thumbnail rail.
- Click thumbnails or previous/next controls to move between slides.
- Drag thumbnails to reorder slides.
- Add, duplicate, delete, reorder, and change duration from the Slides screen.
- Export video now lives inside the Slides screen.
- Edit Slide returns to the main editor with the selected slide active.

## v0.8.30

- Fixed Slide -> Edit Slide -> Slides round-trip.
- Editor now shows a `← Slides` button when opened from the Slides screen.
- Returning to Slides forces an immediate save before navigation.
- Clicking the left-rail Slides button also forces an immediate save.
- Added a return-to-slides marker in chrome.storage.local so the editor knows it is in slide-edit mode.
- Slide changes now persist when switching back to the dedicated Slides screen.


## v0.8.31

- Fixed Slides button crash in editor.
- Removed invalid `saveState()` call.
- Added globally defined `RETURN_TO_SLIDES_KEY`.
- Both Slides navigation paths now use the editor's existing save mechanism before navigation.

## v0.9.1

- Added native copy, cut, and paste for selected text/table objects.
- Pasting plain text on the canvas creates a new text block.
- Pasting an image on the canvas uses it as the image background.
- Added a contextual trash icon for the selected canvas object.
- Delete/Backspace removes a selected object when not editing its contents; Cmd/Ctrl+X cuts it.
- Fixed mouse text selection by preserving native pointer behavior while a text block is being edited.
- Added a publishable privacy policy for the Chrome Web Store listing.

## v0.9.2

- Restored the **Back to Slides** button while editing a slide.
- Opening **Edit slide** now loads the selected slide instead of stale editor content.
- Returning to Slides now saves the active slide immediately before navigation.

## v0.9.3

- Paste copied images or screenshots onto the card with Cmd+V / Ctrl+V. Images become separate objects, preserving the background.
- Drag images to move them; drag any of the four corners or use the Image size slider to resize with proportions locked.
- Add one or more image files through Image → Add image to card. Background image upload remains available separately.
- Image objects support copy/cut/paste within PostCard, duplicate, delete, undo/redo, saved sessions, slide editing, and canvas/slideshow export.
- No additional extension permissions.

Validation: `node --test tests/image-objects.test.cjs`. Full Chrome interaction testing is still required; the automated browser download was unavailable in the build environment.


## v0.9.4

- Text objects use drag to move and double-click to edit. Press Escape or choose Move object to leave text editing; an already selected text object remains draggable in move mode.
- Layers lists text, images and tables from front to back, including covered objects.
- Bring to Front, Send to Back, Forward and Backward reorder objects across types. The card backdrop remains underneath all objects.
- Arrow keys move the selected object by one output pixel; Shift+arrow moves ten pixels, including objects selected through Layers.
- Layer order persists with saved cards, undo/redo, slide editing, PNG export and slideshow/video rendering.

Validation: regression tests cover text/image pointer handlers, all resize corners, old and new object ordering, history/slide round trips and both export renderers. Live browser interaction testing could not run because the cloud browser blocked the local preview URL.

## v0.9.5 — feature recovery

- Restored text orientation: dial, exact degrees, common-angle snapping, and resize detection for rotated text.
- Added a direct Export MP4 action for GIF-based cards, with duration, progress, animated image objects and text/background motion effects.
- Recovered slideshow narration, music, volume controls, preview and export progress. Added the full-music-length option and preserved audio metadata during slide editing.
- Retained image paste, independent object movement/resizing, layers and front/back controls.
- Preserved stable slide IDs and long durations; removed duplicate editor control IDs.
- Added feature preservation checks and recovery provenance in `docs/FEATURE-PRESERVATION.md`.

Actual Chrome interaction, microphone capture and MP4 playback testing were blocked by the browser's URL security policy; local regression tests are not a substitute for those checks.
