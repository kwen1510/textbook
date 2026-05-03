---
name: textbook-template
description: Use this skill when a user wants to turn a public GitHub repository with Markdown/course/docs content into a deployable Textbook study app with notes, progress, recall, PWA behavior, attribution, and optional Groq AI features.
---

# Textbook Template

## Workflow

1. Confirm the user is working in their own Textbook copy/fork/template repo, not the shared `kwen1510/textbook` template repository.
2. Confirm the user provided a source repository URL and app name.
3. Choose an app mode:
   - `private-synced` by default for Vercel, Neon Auth, and Neon Postgres.
   - `local-only` only when the user wants no auth/cloud database and accepts local file storage.
4. Explain the repository model if needed: copy/fork/use-template Textbook, do not fork the source repo by default, ingest the source URL into the Textbook copy.
5. Inspect the source repository license before ingestion. If no license is present, or the license does not clearly allow the requested copying/transformation/deployment, stop and explain the risk.
6. Run `npm install` if dependencies are missing.
7. Run `npm run ingest -- <repo-url>` from the repo root.
8. Review generated `src/generated/course.json`, `textbook.config.json`, and `ACKNOWLEDGEMENTS.md` for correct attribution.
9. Inspect the generated course for content completeness: source sections, diagrams/images, tables, code blocks, internal links, and attribution should be preserved, not reduced to a short summary.
10. Verify the review deck is generated from all sections through `getReviewCards()`. Do not hand-write a small sample set of review prompts.
11. Review `PUBLISHING_CHECKLIST.md` with the generated course context.
12. Update branding to the requested app name if it differs from `Textbook`.
13. If `local-only`, set `TEXTBOOK_MODE=local` in `.env.local`, skip Neon setup, and confirm `.textbook/` remains git-ignored. If `private-synced`, keep Neon/Vercel setup instructions.
14. Run `npm test`, `npm run lint`, and `npm run build`.
15. Check no secrets or local config were added before committing.
16. Tell the user to commit generated course files plus `textbook.config.json`, then set the required environment variables for the selected mode. Groq is optional unless the user wants AI assistant or voice transcription.

## UX Contract

- Keep the reader mobile-first: sticky top app nav, phone chapter drawer from the header, tablet/desktop chapter rail on the left, no fixed bottom tab bar.
- Show chapter status dots in the chapter drawer/sidebar: unread, in progress, done, and for review.
- The home page must show a clear resume target. If the latest viewed section is completed, continue to the next unfinished section after it; otherwise resume the latest viewed section.
- Show section status dots/pills in the `On this chapter` rail.
- Use one active `Reading notes` panel for the page. It opens from a collapsed bottom-right dock on tablet/desktop and from a bottom dock on phone.
- On tablet/desktop, keep the chapter map expanded in a sticky/floating left rail. It should remain visible while the reader scrolls, and it may scroll internally only when the chapter list exceeds the viewport.
- On tablet/desktop, the reading-notes dock should float in the bottom-right, expand/collapse, and stay above bottom navigation controls.
- Keep the reading-notes sheet focused on capture: page title, current save target, note box, Save, mic, and saved notes. Do not put progress dropdowns or manual completion controls inside the notes sheet.
- The notes sheet must close from the handle, close button, or outside tap, and it must not obscure next/previous navigation.
- Auto-set unread sections to `currently viewing` when they enter the reading band.
- Auto-complete sections after the user scrolls past them, unless the user manually resets the section.
- `Next` and `Next chapter` must mark every section on the current chapter/page completed before navigating so the previous chapter status turns done.
- Notes have two main modes: page notes and highlighted-text notes. The reading-notes panel is page-level, aggregates notes across the current chapter/page, and must not jump its main page label as sub-sections enter the viewport.
- New notes must be saved against the active section/subheading and saved note cards must show which section they were added to.
- Store highlighted text separately from the note body and re-highlight saved text when the user returns. The selection toolbar should expose `Highlight`, not a confusing `Add note` action.
- Restored highlights should be clickable/tappable and open the same highlight in the reading-notes editor without duplicating it elsewhere in the panel.
- The mobile notes sheet should minimise from the handle/backdrop without a close button, and non-empty drafts should autosave without creating duplicate notes.
- Assistant explanations and selected terms should be saved as notes so the user can revisit them later.
- Voice note buttons use a mic icon and visible recording state; tapping again stops recording. Use a subtle red glow for active recording, not a pulsing animation.
- Trim voice transcription text at the API boundary and again before inserting it into notes, review answers, or assistant inputs.
- PWA refresh prompts must show immediate feedback after click, such as disabling the button and showing `Refreshing...` with a spinner.

## Review Contract

- Generate one review card for every course section from `src/generated/course.json`.
- Review cards should mix open scenario questions and MCQ cards when the content supports it. Never limit review to the first few sections of each chapter.
- Each card must include a source link, suggested answer, key points extracted from the source Markdown, and enough context to answer from memory before checking the source.
- The review page only shows completed or `needs_review` sections. Ratings save a recall attempt and schedule the next due date in `review_schedules`.
- Ratings mean: `again` returns in 30 minutes, `hard` tomorrow, `good` in 3 days, and `easy` in 7 days.
- Review voice answers should use the same transcription endpoint as notes and trim transcripts before saving or inserting into the answer box.
- The assistant follow-up in review mode should use the review question, suggested answer, current answer, and source section as context, and should save useful assistant outputs as notes.
- Health checks must include `review_schedules`; missing review tables should be reported as deployment/runtime issues.

## Safety Rules

- Never commit `.env.local`, `.vercel`, `.next`, `node_modules`, API keys, database URLs, cookies, or local credentials.
- Never commit `.textbook/` or local data-store files.
- Keep only placeholder values in `.env.example`.
- Preserve upstream attribution and license notes.
- Textbook is for personal, educational, nonprofit, and other noncommercial use only.
- Keep generated apps private by default unless the source license or written permission allows public redistribution.
- The Textbook license covers the app shell only; it does not grant rights to any source content.
- Do not bypass the no-license ingestion gate unless the user confirms they own the content or have written permission.
- If the source repo is not Markdown-heavy, explain that a custom adapter may be needed before proceeding.
- Do not commit `content/source`; it is a temporary ignored clone of the source repository.
- Do not push generated course content back to `kwen1510/textbook`; generated apps belong in the user's fork.
- `TEXTBOOK_MODE=local` is local-only/no-auth mode. It stores user data in a git-ignored local file and should not be used for Vercel deployment.

## Quality Checks

Run:

```bash
npm run ingest -- <repo-url>
npm test
npm run lint
npm run build
rg -n "gsk[_]|machinelearning\\.kw|ep-solitary-hill|\\.env.local" .
```

Only placeholder documentation hits are acceptable.

## Deployment Instructions To Give The User

- Vercel project source: the user's fork of Textbook.
- Vercel root directory: repository root.
- Framework preset: Next.js.
- Build command: `npm run build`.
- Required env vars: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `ALLOWED_USER_EMAIL`.
- Optional env vars: `GROQ_API_KEY`, `GROQ_STUDY_MODEL`, `SOURCE_REPO_URL`, `CANONICAL_HOST`.
- Local-only env var: `TEXTBOOK_MODE=local`. It writes to `.textbook/local.json`; do not set this on Vercel.
- `GROQ_STUDY_MODEL` defaults to `llama-3.1-8b-instant`, but the user can swap to another Groq chat model.
- `GROQ_API_KEY` is required only for AI assistant and voice transcription.
- Voice transcription model is `whisper-large-v3-turbo`.

## Deeper Acceptance Criteria

For detailed ingestion, UX, and review checks, read `.codex/skills/textbook-template/references/textbook-acceptance.md` when updating the template or evaluating a generated app.
