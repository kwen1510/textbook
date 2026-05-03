# Textbook Acceptance Criteria

## Ingestion

- Preserve the source repository content as a course, not a short summary.
- Keep source Markdown structure, code blocks, tables, diagrams, images, and meaningful local links.
- Generate deterministic chapter and section IDs so notes, progress, and review schedules remain stable.
- Rewrite local assets into `public/course-assets` and keep external links safe with `target="_blank"` and `rel="noopener noreferrer"`.
- Rewrite internal links to `/course/<chapter>#<section-or-heading>` whenever the target exists in the generated course.
- Stop on missing or unclear source licenses unless the user confirms they own the content or have written permission.
- Update `ACKNOWLEDGEMENTS.md` with source repo, commit, detected license file, and redistribution cautions.

## Reading UX

- Keep the top app navigation sticky and use it for global navigation.
- On phone, open the chapter map from the header. On tablet/desktop, keep the chapter map visible as a sticky/floating left rail.
- Show chapter-level status dots and section-level status pills from live progress state.
- Use one page-level `Reading notes` panel for the current chapter/page. It should aggregate notes across sections and save new notes to the active section.
- On phone, notes open as a bottom sheet. On tablet/desktop, notes float from the bottom-right and stay clear of next/previous navigation.
- Keep the notes sheet focused on note capture: page label, current save target, note box, saved notes, Save, and voice input.
- Saved highlight notes store quote text separately from the note body. Restored highlights should be clickable and reopen the same highlight in the notes editor.
- Auto-mark unread sections as reading when they enter the reading band. Auto-complete sections after the reader passes them unless manually reset.
- `Next` and `Next chapter` should complete every section on the current chapter/page before route navigation.

## Storage Modes

- Private synced mode is the default and uses Neon Auth plus Neon Postgres. Use this for Vercel and cross-device sync.
- Local-only mode is opt-in with `TEXTBOOK_MODE=local`. It must not require `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, or `ALLOWED_USER_EMAIL`.
- Local-only mode stores notes, progress, recall attempts, review schedules, and transcription metadata in `.textbook/local.json` by default.
- `.textbook/` and local data-store files must be ignored by git.
- Local-only mode should show a local status badge instead of Neon sign-out controls.
- Vercel instructions must tell users not to deploy with `TEXTBOOK_MODE=local`.

## Review UX

- Generate one review card per section through `getReviewCards()`.
- Review cards should include source link, mode (`open` or `mcq`), difficulty, question, suggested answer, key points, and source hint.
- Use MCQ only when there are enough plausible section-title distractors. Otherwise use open scenario questions.
- The review page should show only completed or marked-for-review sections, with stats for studied, due now, and mastered.
- Saving a rating must insert a recall attempt and upsert a `review_schedules` row.
- Rating schedules: `again` in 30 minutes, `hard` in 1 day, `good` in 3 days, `easy` in 7 days.
- Voice review answers should transcribe through `/api/transcribe`, trim the result, and insert it into the editable answer before saving.
- Review follow-up questions should call `/api/study-assistant` with the review question, suggested answer, current answer, and section context.

## Verification

Run these before presenting the generated app as complete:

```bash
npm run ingest -- <repo-url>
npm test
npm run lint
npm run build
rg -n "gsk[_]|machinelearning\\.kw|ep-solitary-hill|\\.env.local" .
```

For local-only mode, also run:

```bash
TEXTBOOK_MODE=local npm run build
```

Generated app tests should include:

- Unique section IDs.
- Plain-text chapter descriptions.
- No insecure rendered image URLs.
- Safe external links.
- No dead same-page hash links.
- One review card per section.
- Valid MCQ choices when a card uses MCQ mode.
