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
