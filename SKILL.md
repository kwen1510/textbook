---
name: textbook-template
description: Use this skill when a user wants to turn a public GitHub repository with Markdown/course/docs content into a deployable Textbook study app with notes, progress, recall, PWA behavior, attribution, and optional Groq AI features.
---

# Textbook Template

## Workflow

1. Confirm the user is working in their own fork of the Textbook template, not the shared template repository.
2. Confirm the user provided a public GitHub repository URL and an app name.
3. Inspect the source repository license before ingestion. If no license is present, or the license does not clearly allow the requested copying/transformation/deployment, stop and explain the risk.
4. Run `npm run ingest -- <repo-url>` from the repo root.
5. Review generated `src/generated/course.json`, `textbook.config.json`, and `ACKNOWLEDGEMENTS.md` for correct attribution.
6. Update branding to the requested app name if it differs from `Textbook`.
7. Run `npm test`, `npm run lint`, and `npm run build`.
8. Check no secrets or local config were added before committing.
9. Tell the user to commit generated course files plus `textbook.config.json`, then set the required Neon, Groq, and Vercel environment variables.

## Safety Rules

- Never commit `.env.local`, `.vercel`, `.next`, `node_modules`, API keys, database URLs, cookies, or local credentials.
- Keep only placeholder values in `.env.example`.
- Preserve upstream attribution and license notes.
- Textbook is for personal, educational, nonprofit, and other noncommercial use only.
- Keep generated apps private by default unless the source license or written permission allows public redistribution.
- The Textbook license covers the app shell only; it does not grant rights to any source content.
- If the source repo is not Markdown-heavy, explain that a custom adapter may be needed before proceeding.

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
