# Textbook Quickstart

The fastest safe path is: create your own copy of Textbook, open it in Codex, paste one prompt, and provide the source repository URL.

## Recommended Path

1. Click **Use this template** or **Fork** on `https://github.com/kwen1510/textbook`.
2. Name the new repository after your course app.
3. Open your new repository in Codex.
4. Paste the prompt from [CODEX_PROMPT.md](CODEX_PROMPT.md).
5. Replace `SOURCE_REPO_URL` and `APP_NAME` in the prompt.
6. Let Codex ingest, test, build, and summarize the remaining setup.
7. Deploy your repository to Vercel from the repository root.

You do **not** need to fork the source/course repository. Textbook only needs the public source URL. The ingestion script clones the source temporarily into `content/source`, which is ignored by git.

## Simplest Prompt

```text
Read SKILL.md first and follow the textbook-template workflow in this repository.

Create my private, noncommercial Textbook study app.

Required:
- SOURCE_REPO_URL=<paste public GitHub repo URL here>
- APP_NAME=<your app name>

Use the safest defaults. Check the source license before ingesting. If allowed, ingest the source, preserve attribution, run tests/lint/build, check for secrets, and tell me the remaining Neon, Groq, and Vercel setup steps.
```

## Optional Details

Add these only if you already know them:

```text
- ALLOWED_USER_EMAIL=<your login email>
- USE_GROQ_AI=yes
- DEPLOY_TARGET=Vercel
```

If you leave them out, Codex should proceed with the app setup and tell you what values are still needed.

## What Gets Committed

Your generated app repository should contain:

- Textbook app shell
- `src/generated/course.json`
- `src/generated/course.ts`
- `textbook.config.json` after ingestion
- `ACKNOWLEDGEMENTS.md`
- tests and app code

It should not contain:

- `.env.local`
- `.vercel`
- `.next`
- `node_modules`
- `content/source`
- API keys, database URLs, cookies, or personal credentials

## Local Commands

```bash
npm install
npm run ingest -- <public-github-repo-url>
cp .env.example .env.local
npm run db:migrate
npm run dev
npm test
npm run lint
npm run build
```

## Vercel Settings

When importing your generated app repository into Vercel:

- Framework preset: `Next.js`
- Root directory: repository root / blank
- Build command: `npm run build`
- Output directory: default

`npm run build` runs ingestion first. This works when either `textbook.config.json` is committed or `SOURCE_REPO_URL` is set in Vercel.

## Environment Variables

Required for full private synced app:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
NEON_AUTH_BASE_URL="https://YOUR-NEON-AUTH-URL"
NEON_AUTH_COOKIE_SECRET="replace-with-at-least-32-random-characters"
ALLOWED_USER_EMAIL="you@example.com"
```

Optional AI features:

```bash
GROQ_API_KEY="your-groq-api-key"
GROQ_STUDY_MODEL="llama-3.1-8b-instant"
```

`GROQ_STUDY_MODEL` defaults to `llama-3.1-8b-instant`. You can swap it for another Groq chat model if you prefer. Voice transcription uses `whisper-large-v3-turbo`.

## Safe Publishing Rule

Keep generated course apps private unless the source license or written permission clearly allows public redistribution and derivative works. Textbook blocks unlicensed public repositories by default.
