# LLG App: working rules

## Before handing Karla any code
- Check every Wix function name against current Wix docs. Never
  invent one. If unsure, say so.
- Mark findings "verified by live test", "from docs" or "my guess".
- List every package to install (Velo package manager or npm) and
  where.
- No silent catches. Log the error message, then fail safely.
- Remove debug logging of member data after testing.
- Tell Karla where to see logs for anything running on Wix.

## Security
- Keys and secrets from environment variables only. Never inline,
  never printed, never in chat.
- Read-only Wix API key stays read-only.
- Never trust a member ID from the browser. Only a verified pass.
- Hash, not query string, for anything identifying. Cookies, not
  localStorage (Wix web views clear it).
- Supabase: RLS on every table, no browser access. Only Netlify
  functions using SUPABASE_SERVICE_KEY.

## Build and deploy
- Read files before editing.
- Deploy by git push only. Never netlify deploy --prod.
- 9-second AbortController timeout on every outbound call.
- Write SQL for Karla to run in Supabase Studio. Don't run it.

## Testing
- Hidden test services only, never live ones.
- Automatic discount rules scoped to test services only.
- Stop before paying unless Karla says otherwise.
- Agree a time limit per test. If the key test fails, stop and
  report. Don't troubleshoot Wix.

## Architecture
- Wix is the till and the diary. Our layer (Netlify + Supabase) is
  the brain and stores what Wix can't.
- Karla knows Wix's limits. Trust her on what Wix can't do.

## Style
- UK English. No em dashes. Plain language.
