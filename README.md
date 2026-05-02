# Textbook

Textbook is a reusable private course-app template. Create your own copy, open it in Codex, paste a licensed public GitHub repository with course or documentation content, and Codex can turn that content into a deployable study app with reading, notes, progress, recall, and optional AI help.

Textbook is for personal, educational, nonprofit, and other noncommercial use only. It does not grant rights to third-party content. Only ingest content you own, have permission to use, or whose license allows the transformation you plan to make.

Textbook stops ingestion of public repositories with no detected license by default. This is intentional: public GitHub access is not the same as permission to copy, adapt, or deploy content.

## Use With Codex

Fastest path:

1. Click **Use this template** or **Fork** on this repository.
2. Open your new repository in Codex.
3. Paste the prompt from [CODEX_PROMPT.md](CODEX_PROMPT.md).
4. Replace `SOURCE_REPO_URL` and `APP_NAME`.
5. Let Codex do the ingestion, checks, and build.

You do not need to fork the source/course repository. Textbook only needs the public source URL.

One-shot prompt:

```text
Read SKILL.md first and follow the textbook-template workflow in this repository.

Create my private, noncommercial Textbook study app.

Required:
- SOURCE_REPO_URL=<paste public GitHub repo URL here>
- APP_NAME=<your app name>

Use the safest defaults. Check the source license before ingesting. If allowed, ingest the source, preserve attribution, run tests/lint/build, check for secrets, and tell me the remaining Neon, Groq, and Vercel setup steps.
```

See [QUICKSTART.md](QUICKSTART.md) for the full flow.

## Local Setup

```bash
npm install
npm run ingest -- <public-github-repo-url>
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Environment variables for the full private synced app:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
NEON_AUTH_BASE_URL="https://YOUR-NEON-AUTH-URL"
NEON_AUTH_COOKIE_SECRET="replace-with-at-least-32-random-characters"
ALLOWED_USER_EMAIL="you@example.com"
GROQ_API_KEY="your-groq-api-key"
GROQ_STUDY_MODEL="llama-3.1-8b-instant"
# Optional for Vercel builds if you do not commit textbook.config.json
SOURCE_REPO_URL="https://github.com/org/repo"
```

Groq is optional. Without `GROQ_API_KEY`, the core reading, notes, progress, and review features still work. `GROQ_STUDY_MODEL` defaults to `llama-3.1-8b-instant`; you can change it to another Groq chat model if you want a different cost, speed, or quality tradeoff.

## Deploy

Deploy your fork to Vercel after setting the same environment variables in Project Settings. Import the forked repository, keep the root directory as the repository root, and use the default Next.js settings. `npm run ingest -- <repo-url>` writes `textbook.config.json` with the public source URL; commit that file with the generated course so Vercel can re-ingest on build. Alternatively, set `SOURCE_REPO_URL` in Vercel. Run `npm run build` locally before deploying.

## Source Attribution

After ingestion, `ACKNOWLEDGEMENTS.md` is updated with the source repository, commit, and detected license file when available. Check the upstream license before publishing transformed content. If Textbook cannot detect a license, ingestion stops unless you explicitly bypass the gate for content you are authorized to use.

## Responsible Use

Use Textbook private-by-default. Do not publish generated content unless the source license or written permission allows redistribution and derivative works. See [CONTENT_POLICY.md](CONTENT_POLICY.md) and [PUBLISHING_CHECKLIST.md](PUBLISHING_CHECKLIST.md) before ingesting another repository or sharing a generated app.

## License

The Textbook template code is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). Third-party course content remains under its own source license.
