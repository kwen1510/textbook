---
name: textbook-template
description: Use this skill when a user wants to turn a public GitHub repository with Markdown/course/docs content into a deployable Textbook study app with notes, progress, recall, PWA behavior, attribution, and optional Groq AI features.
---

# Textbook Template

## Workflow

1. Confirm the user is working in their own Textbook copy/fork/template repo, not the shared `kwen1510/textbook` template repository.
2. Confirm the user provided a source repository URL and app name.
3. Explain the repository model if needed: copy/fork/use-template Textbook, do not fork the source repo by default, ingest the source URL into the Textbook copy.
4. Inspect the source repository license before ingestion. If no license is present, or the license does not clearly allow the requested copying/transformation/deployment, stop and explain the risk.
5. Run `npm install` if dependencies are missing.
6. Run `npm run ingest -- <repo-url>` from the repo root.
7. Review generated `src/generated/course.json`, `textbook.config.json`, and `ACKNOWLEDGEMENTS.md` for correct attribution.
8. Review `PUBLISHING_CHECKLIST.md` with the generated course context.
9. Update branding to the requested app name if it differs from `Textbook`.
10. Run `npm test`, `npm run lint`, and `npm run build`.
11. Check no secrets or local config were added before committing.
12. Tell the user to commit generated course files plus `textbook.config.json`, then set the required Neon/Vercel environment variables. Groq is optional unless the user wants AI assistant or voice transcription.

## Safety Rules

- Never commit `.env.local`, `.vercel`, `.next`, `node_modules`, API keys, database URLs, cookies, or local credentials.
- Keep only placeholder values in `.env.example`.
- Preserve upstream attribution and license notes.
- Textbook is for personal, educational, nonprofit, and other noncommercial use only.
- Keep generated apps private by default unless the source license or written permission allows public redistribution.
- The Textbook license covers the app shell only; it does not grant rights to any source content.
- Do not bypass the no-license ingestion gate unless the user confirms they own the content or have written permission.
- If the source repo is not Markdown-heavy, explain that a custom adapter may be needed before proceeding.
- Do not commit `content/source`; it is a temporary ignored clone of the source repository.
- Do not push generated course content back to `kwen1510/textbook`; generated apps belong in the user's fork.

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
- `GROQ_STUDY_MODEL` defaults to `llama-3.1-8b-instant`, but the user can swap to another Groq chat model.
- `GROQ_API_KEY` is required only for AI assistant and voice transcription.
- Voice transcription model is `whisper-large-v3-turbo`.
