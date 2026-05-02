# Textbook Quickstart

This guide explains the cleanest way to turn a licensed public GitHub repository into your own private study app.

## The Three Repositories

1. **Template repo**: `https://github.com/kwen1510/textbook`
   This is the reusable app shell. Fork this.

2. **Source repo**: the public course/docs repo you want to study
   Do not fork this by default. Textbook only needs its public URL. The ingestion script clones it temporarily into `content/source`, which is git-ignored.

3. **Your generated app repo**: your fork of Textbook after ingestion
   This is the repo you deploy to Vercel. It belongs to you and contains your generated course data, app settings, and deployment history.

## Recommended Flow

1. Fork `https://github.com/kwen1510/textbook` into your own GitHub account.
2. Clone your fork locally, or open your fork in Codex.
3. Ask Codex to read `SKILL.md` and follow the Textbook workflow.
4. Give Codex the source repository URL and app name.
5. Codex checks the source license first.
6. Codex runs ingestion, tests, and build.
7. Commit the generated course files to your fork.
8. Import your fork into Vercel and deploy from the repository root.

You usually do **not** need to fork the source repository. Fork the source repository only if you plan to edit that source material separately or contribute changes upstream.

## Copy-Paste Codex Prompt

```text
Read SKILL.md first and follow the textbook-template workflow in this repository.

I am working in my own fork of Textbook. Use this Textbook template to create a private, noncommercial study app from this public GitHub repository:

SOURCE_REPO_URL=<paste public GitHub repo URL here>
APP_NAME=<your app name>

Before ingesting, check the source repository license. If the license is missing, unclear, or does not allow copying/adaptation/deployment for this use, stop and explain the issue.

If the source is allowed, run the full workflow: install dependencies if needed, ingest the source repo, preserve attribution in ACKNOWLEDGEMENTS.md, verify generated links/assets, run tests/lint/build, check for secrets, and tell me the exact Neon, Groq, and Vercel setup steps.
```

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

When importing your fork into Vercel:

- Framework preset: `Next.js`
- Root directory: leave blank / repository root
- Install command: default or `npm install`
- Build command: `npm run build`
- Output directory: leave default

`npm run build` runs `npm run ingest` first. This works on Vercel when either:

- `textbook.config.json` is committed by Codex after ingestion, or
- `SOURCE_REPO_URL` is set as a Vercel environment variable.

## Required Environment Variables

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
NEON_AUTH_BASE_URL="https://YOUR-NEON-AUTH-URL"
NEON_AUTH_COOKIE_SECRET="replace-with-at-least-32-random-characters"
ALLOWED_USER_EMAIL="you@example.com"
GROQ_API_KEY="your-groq-api-key"
GROQ_STUDY_MODEL="llama-3.1-8b-instant"
```

`GROQ_STUDY_MODEL` defaults to `llama-3.1-8b-instant`. You can swap it for another Groq chat model if you prefer different cost, speed, or quality. Voice transcription uses `whisper-large-v3-turbo`.

## Safe Publishing Rule

Keep generated course apps private unless the source license or written permission clearly allows public redistribution and derivative works. Textbook blocks unlicensed public repositories by default.
