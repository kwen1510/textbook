# Codex Prompt

Use this prompt inside your fork of Textbook.

```text
Read SKILL.md first and follow the textbook-template workflow in this repository.

I am working in my own fork of Textbook. Use this Textbook template to create a private, noncommercial study app from this public GitHub repository:

SOURCE_REPO_URL=<paste public GitHub repo URL here>
APP_NAME=<your app name>

Before ingesting, check the source repository license. If the license is missing, unclear, or does not allow copying/adaptation/deployment for this use, stop and explain the issue.

If the source is allowed, run the full workflow: install dependencies if needed, ingest the source repo, preserve attribution in ACKNOWLEDGEMENTS.md, verify generated links/assets, run tests/lint/build, check for secrets, and tell me the exact Neon, Groq, and Vercel setup steps.
```
