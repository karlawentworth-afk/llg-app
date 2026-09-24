# LLG App — Working Rules

## Architecture
- **Wix is the till and the diary**: members, plans, bookings, payments, loyalty
  balances. Don't try to make Wix do what it can't.
- **Our layer (Netlify + Supabase) is the brain**: reads Wix data, decides
  pricing and what each member sees, and stores anything Wix can't hold
  (session topics, venue perks, home venue, preferences, programme progress).
- **Wix branded app** embeds our Netlify pages inside Wix pages. The Velo
  backend generates an HMAC-signed pass so the embed knows which member is
  viewing it.

## Security
- Keys from environment variables only, never inline in code.
- Wix API key is read-only. Do not attempt any write calls with it.
- The embed pass uses hash fragment (#p=...), never query string, for
  anything identifying.
- 9-second AbortController timeout on every outbound call.
- No personal data in logs. Never trust a member ID sent from the browser;
  only trust a verified pass.
- Supabase: RLS on every table. No browser access. Only Netlify functions
  using the service role key.

## Environment Variables (Netlify)
- `WIX_EMBED_SECRET` — shared HMAC secret (also in Wix Secrets Manager as `LLG_EMBED_SECRET`)
- `WIX_API_KEY` — read-only Wix API key (starts with IST.)
- `WIX_SITE_ID` — Wix site GUID
- `WIX_ACCOUNT_ID` — Wix account GUID
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key

## Wix API Endpoints (verified by live test)
- Plans: `GET /pricing-plans/v2/orders?buyerIds=...&orderStatuses=ACTIVE`
- Bookings: `POST /_api/bookings-reader/v2/extended-bookings/query`
  - Filter by `contactDetails.contactId`, `status`, `startDate`
- Loyalty: `POST /loyalty-accounts/v1/accounts/search`
  - Filter by `contact.id`
- All calls require headers: `Authorization: <apiKey>`, `wix-site-id`, `wix-account-id`

## Wix Plan IDs
- Physical membership: `530c7704-3e17-4f8f-bc5a-5ceec84ae16c`
- Complete membership: `00478766-f484-40f0-9d4a-1fb329b54da5`
- Digital membership: `8324fc1b-c344-454c-af4d-eed9639b7222`

## Custom Discount Trigger SPI (verified by live test 2026-09-24)
- Velo path: `backend/___spi___/ecom-discounts-trigger/discount-trigger/`
- Uses `@wix/pricing-plans` with `auth.elevate()` from `@wix/essentials`
- `context.identity.memberId` confirmed as the member ID field
- Works in website checkout AND Wix branded app checkout
- Stacks with manual coupon codes
- Does NOT apply to Wix Events (separate checkout system)

## Velo Code
- The embed pass backend uses `crypto-js` (not Node crypto or Web Crypto —
  neither is available in Velo's backend runtime).
- Wix Secrets Manager name: `LLG_EMBED_SECRET`

## Conventions
- Deploy by git push only (Netlify auto-deploys from GitHub).
- Repo: `karlawentworth-afk/llg-app`
- Netlify site: `llg-app-test`
- Velo reference code is stored in `wix-velo-code/` for version control
  but is pasted into the Wix Editor manually.

## Parked
- Session topics via Calendar Events V3 API — risk of detaching sessions
  from their recurring schedule. Parked for later.
- Route 4 (Stripe payments, Wix records booking) — researched, not built.
  Available if Route 1 SPI can't cover a future need.
