# Prompt history

The brief asks for the **raw, unedited** agent sessions used to build this app, with secrets removed
before delivery. This folder holds them.

| File | What it is |
|---|---|
| `copilot-cli-session-raw.json` | A raw export of the Copilot CLI session that built the domain engine, the SQLite layer, the agent loop and the UI passes. Structure and wording are untouched — failed attempts and dead ends included. |

## What was removed

Only secrets. Every `sk-…` API key literal and any `LLM_API_KEY=` / `SESSION_SECRET=` value was replaced
with `<redacted>`; nothing else was edited, summarised or reordered. Verify with:

```bash
git --no-pager grep -nE "sk-[A-Za-z0-9]{16,}" -- "prompt history"
```

That scan must return nothing.

## Adding later sessions

Export the session as JSON into this folder and run the same redaction over it before committing:

```bash
node -e "const fs=require('fs');const f=process.argv[1];fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/sk-[A-Za-z0-9_-]{16,}/g,'sk-<redacted>'))" "prompt history/<new-session>.json"
```

Never commit `.env.local`, `data/`, or an unredacted export.
