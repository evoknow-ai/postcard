# PostCard release checks

The v0.9.3/0.9.4 image feature builds were based on an older main branch that lacked previously delivered features. Version 0.9.5 restores the recovered motion/audio code and combines it with the image/layer work.

Recovery source: `PostCard-v0.9.1-motion-graphics.zip`, generated August 29, 2026. The later orientation implementation was not present in the available artifacts; its dial, angle snapping and rotated resize behavior have been rebuilt. Do not use version numbers alone to establish the feature baseline.

Before delivering a release, run `node --test tests/*.test.cjs` and the JavaScript syntax checks. Preserve these workflows:

- Text: editing, dragging, resize, orientation dial, common-angle snapping, numeric angle, undo/redo.
- Objects: image clipboard paste, file insertion, independent movement/resizing, ordering across images/text/tables, selection of covered objects, PNG export.
- Motion: animated GIF backgrounds and image objects; text entrance effects; background pan/zoom; direct MP4 export with duration and progress.
- Slides: stable IDs, add/duplicate/reorder/delete, Edit Slide → Back to Slides, saved per-slide duration, narration recording, music, audio levels, full music duration option, video export progress.
- Rendering: retain layer order, text orientation, GIF frames and motion in card and slide exports. Encode actual MP4, or report unsupported encoding; never label WebM bytes as MP4.
- State: retain slide audio IDs, voice levels, presentation music settings and durations when the editor saves a card or slide.

Validation limits for v0.9.5: local tests cover geometry, ordered rendering, frame selection, state preservation and control availability. Browser security policy blocked live UI and MediaRecorder testing. Actual microphone capture and generated MP4 playback therefore remain unverified in Chrome. No Chrome Web Store release was performed.


Version 0.9.11 uses the complete 0.9.10 feature baseline from `feature/image-paste-resize`. Do not rebuild this release from the older `main` branch. The editor now loads directly from `editor.html`; do not restore the removed bridge loader. Startup tests read script tags from the HTML and exercise the add/edit/return flow, reordered IDs, delayed/failed saves, and duration/audio preservation.
