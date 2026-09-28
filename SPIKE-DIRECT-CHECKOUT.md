# Spike: Skip the Wix booking form (direct checkout)

## Question
Can we send a member straight to Wix checkout for one specific
session, skipping the booking form, then back to us after payment?
Does she keep her member identity so discounts and points work?

## Answer: yes, via a Wix proxy page

### Approach: app-checkout Wix page

A hidden Wix page (`/app-checkout`) that receives slot details in
the URL and calls `checkoutBooking()` from `wix-bookings-frontend`.

**Why this works:**
- The member is already logged in on the Wix site (she came from
  the Wix app, which runs inside a Wix web view)
- `checkoutBooking()` opens the Wix payment popup inline
- The SPI discount triggers run in the Wix context and receive
  her member ID (same as the current booking form flow)
- After payment, Wix shows the thank-you page, which redirects
  back to our app

**Flow:**
1. Member taps Book in our app
2. Our app redirects to `ladieslovegolf.com/app-checkout?serviceId=X&startDate=Y&endDate=Z`
3. The Velo page code calls `checkoutBooking({ slot: { serviceId, startDate, endDate, timezone } })`
4. Wix opens the payment popup (member is logged in, discount applies)
5. After payment: Wix thank-you page -> app-home-test?booked=1 -> Home with fresh bookings

### What's verified

| Claim | Source |
|-------|--------|
| `checkoutBooking()` handles payment for a specific slot | from docs (wix-bookings-frontend) |
| Member is logged in on Wix pages within the app | verified by live test (member discount SPI gets memberId) |
| SPI triggers receive memberId for logged-in members | verified by live test (spi-debug beacon confirmed) |
| Thank-you page can redirect back to our app | built and ready to paste |
| `checkoutBooking()` accepts a slot object with serviceId, startDate, endDate | from docs |

### What's NOT verified (needs testing)

| Claim | Risk |
|-------|------|
| `checkoutBooking()` works with just serviceId + startDate (no sessionId) | medium — docs show sessionId as a field but it may not be required for classes |
| The payment popup appears correctly on the proxy page | low — standard Wix behaviour but untested on this specific page |
| The form fields (name, email) are auto-filled from the member profile | low — expected when logged in but untested |
| Error handling (already booked, fully booked, payment cancelled) | low — standard errors but message text may differ |

### Alternative considered: REST API (createRedirectSession)

`createRedirectSession` with `bookingsCheckout` creates a checkout
URL via the Headless API. This is designed for **external sites**
(not Wix pages). The member would need to log in again during
checkout because the redirect session starts as a visitor.
`maintainIdentity` preserves visitor tracking, not member login.

**Rejected** because the member would lose her identity and the
discount/points triggers wouldn't get her member ID.

### What to test

1. Create the `app-checkout` page in Wix (Members Only, add
   #statusMessage text element)
2. Paste `app-checkout-page-code.js` into the page code
3. Set `USE_DIRECT_CHECKOUT = true` in Home
4. Book a test session — does checkout show member price (GBP15)?
5. Does the points trigger fire if she uses points?
6. Does the thank-you page redirect back to Home?

### Files

- `wix-velo-code/app-checkout-page-code.js` — Velo page code
- `public/home/index.html` — `USE_DIRECT_CHECKOUT` flag (false by default)
- `wix-velo-code/thankyou-page-code.js` — thank-you return (already built)

### Booking form fields to remove (if direct checkout works)

All of them. `checkoutBooking()` uses the logged-in member's
contact details. No form needed. The only UI is the payment popup.

If direct checkout doesn't work (e.g. `checkoutBooking` needs
fields we can't provide), fall back to the current booking form
with the Part 1 thank-you return.
