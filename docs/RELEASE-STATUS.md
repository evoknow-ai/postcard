# PostCard release status

**BLOCKED — no new release approved.**

- Source fingerprint: `b864928a9b61f7a750c49adfb23f2c298f848b3f5dbcb565418b226120662978`
- Source manifest version: 0.9.11 (development changes; no new ZIP issued).
- Automated checks: passed.
- Checklist: 62 cases; 31 have partial automated coverage.
- Chrome/UI/media verification: not tested on this candidate.

## Blocking findings

- No current-candidate Chrome test evidence.

## Current defect work

Duplicate editor window creation is repaired in source with API-level regression tests. This is not yet a verified Chrome fix. Existing extra windows are not automatically closed, to preserve drafts. No claim is made that this repairs every blank-window path. Recorder round trips and context-menu behavior require the explicit browser checks in the checklist.

Live browser access previously rejected the local preview with ERR_BLOCKED_BY_CLIENT. No rendered Chrome, microphone, camera or MP4 playback evidence is available for this candidate.
