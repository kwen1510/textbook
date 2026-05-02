# One-Shot Codex Prompt

Use this prompt inside your own Textbook repo/fork.

```text
Read SKILL.md first and follow the textbook-template workflow in this repository.

Create my private, noncommercial Textbook study app.

Required:
- SOURCE_REPO_URL=<paste public GitHub repo URL here>
- APP_NAME=<your app name>

Optional setup choices:
- ALLOWED_USER_EMAIL=<your login email, or leave blank and ask me later>
- USE_GROQ_AI=yes
- DEPLOY_TARGET=Vercel

Use the safest defaults:
- Treat this repository as my generated app repository.
- Do not fork or modify the source repository.
- Clone the source only through the ingestion script.
- Check the source license before ingesting.
- If the source license is missing, unclear, or does not allow copying/adaptation/deployment for this use, stop and explain the issue.
- Keep the app private by default.
- Preserve attribution in ACKNOWLEDGEMENTS.md.
- Use Groq model llama-3.1-8b-instant unless I ask for another model.

If the source is allowed, do everything needed: install dependencies if needed, ingest the source repo, verify generated links/assets, run tests/lint/build, check for secrets, commit the generated app changes if I ask you to, and tell me only the remaining external setup steps for Neon, Groq, and Vercel.
```
