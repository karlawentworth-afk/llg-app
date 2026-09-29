# Spike v2: Skip the Wix booking form (direct checkout)

## Question
Can we send a member straight to Wix checkout for one specific
session, skipping the booking form, then back to us after payment?
Does she keep her member identity so discounts and points work?

## Answer: yes, via a Wix proxy page calling Bookings V2 + eCommerce

### Approach

A hidden Wix page (`/app-checkout`, Members Only) calls a backend
web module (`checkoutSession.web.js`) with SiteMember permission.
The module:

1. Gets the current member's details (`currentMember.getMember`)
2. Creates a booking (`bookings.createBooking` from wix-bookings.v2)
3. Creates an eCommerce checkout (`checkout.createCheckout`)
4. Gets the checkout URL (`checkout.getCheckoutUrl`)
5. Returns the URL to the page, which redirects with `wixLocation.to`

**No deprecated APIs.** Uses:
- `wix-bookings.v2` (Bookings V2, current) — from docs
- `wix-ecom-backend` (eCommerce checkout, current) — from docs
- `wix-members-backend` (current member, current) — from docs

The old `checkoutBooking()` from `wix-bookings-frontend` was
deprecated on 31 March 2026. This spike does not use it.

### Why this preserves member identity

The web module runs with SiteMember permission. The member is
already logged in on the Wix site (she came from the Wix app).
`elevate()` is used for the booking and checkout creation to
ensure the operations succeed, but the member's contact details
and identity are passed through.

The eCommerce checkout page is a standard Wix page. The member
arrives at it already logged in. The SPI discount triggers run
during the eCommerce flow and should receive her member ID.

### What's verified

| Claim | Source | Tested through app-checkout? |
|-------|--------|------------------------------|
| Bookings V2 createBooking is current (not deprecated) | from docs | No |
| eCommerce createCheckout + getCheckoutUrl is current | from docs | No |
| Wix Bookings app ID is 13d21c63-b5ec-5912-8397-c3a5ddb27a97 | from docs (Wix Business Solutions) | No |
| SPI triggers receive memberId for logged-in members | verified by live test (spi-debug beacon, booking-form flow) | No — tested via booking form, not app-checkout |
| Member is logged in on Wix pages within the app | verified by live test (spi-debug beacon) | No — same |
| currentMember.getMember() returns member details | from docs | No |
| elevate() allows backend to create bookings | from docs | No |

### What MUST be tested through app-checkout

| Test | Pass criteria |
|------|---------------|
| (a) Checkout shows member price (GBP15, not GBP22.50) | Member discount SPI trigger fires with memberId |
| (b) With a points flag, checkout shows GBP0 | Points SPI trigger fires with memberId |
| (c) After paying, member lands back on Home | Thank-you page redirects to app-home-test |
| (d) Booking appears in "Your next session" | home-data skipCache refreshes |

**If (a) fails, stop. Stay on the booking form plus auto-return.**

### Flow

```
App "Book" button
  -> ladieslovegolf.com/app-checkout?serviceId=X&startDate=Y&...
  -> Velo page code calls createCheckoutSession (backend web module)
  -> Backend: createBooking -> createCheckout -> getCheckoutUrl
  -> Page redirects to Wix checkout URL
  -> Member pays (logged in, discounts apply)
  -> Wix thank-you page
  -> app-home-test?booked=1
  -> Home with fresh bookings
```

### Files to paste in Wix

| File | Paste into |
|------|-----------|
| `wix-velo-code/checkoutSession.web.js` | Backend > checkoutSession.web.js |
| `wix-velo-code/app-checkout-page-code.js` | app-checkout page > code panel |

### To test

1. Create the `app-checkout` page in Wix (Members Only)
2. Add `#statusMessage` text element
3. Paste `app-checkout-page-code.js` into the page code
4. Paste `checkoutSession.web.js` into Backend
5. Publish
6. Set `USE_DIRECT_CHECKOUT = true` in Home (or I can do it)
7. Book a test session in the iPhone app

### Packages needed in Velo

- wix-bookings.v2 (install via Package Manager if not present)
- wix-ecom-backend (should already be installed)
- wix-members-backend (should already be installed)
- wix-web-module (built in)
- wix-auth (built in)

### Risk

The main risk is that the eCommerce checkout page may not
trigger the SPI discount triggers the same way the booking form
does. The booking form is the standard Wix Bookings experience;
the eCommerce checkout is a generic checkout page. If the SPI
triggers don't fire, the member sees the full price.

This is why test (a) is the gate: if the member price doesn't
show, we stop and stay on the booking form.
