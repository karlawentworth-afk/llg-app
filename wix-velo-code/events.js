// ────────────────────────────────────────────────────────────
// Backend events.js — paste into Velo > Backend > events.js
//
// Fires when a booking is confirmed (payment received).
// Calls the Netlify settle-points endpoint to deduct loyalty
// points if the member used points for this session.
//
// Requires:
//   Secret: LLG_SPI_SECRET (Wix Secrets Manager)
//
// Event name: wixBookingsV2_onBookingConfirmed
//   — verified in Wix docs (V2, current as of 2026)
//   — from docs
// ────────────────────────────────────────────────────────────

import { getSecret } from "wix-secrets-backend";
import { fetch } from "wix-fetch";
import { members } from "wix-members-backend";

const SETTLE_URL =
  "https://llg-app-test.netlify.app/.netlify/functions/settle-points";

export async function wixBookingsV2_onBookingConfirmed(event) {
  // The booking entity from Wix V2
  const booking = event.data?.booking;
  if (!booking) {
    console.error("events.js: no booking in event");
    return;
  }

  const bookingId = booking._id;
  const contactId = booking.contactDetails?.contactId;
  const serviceId =
    booking.bookedEntity?.slot?.serviceId ||
    booking.bookedEntity?.schedule?.serviceId ||
    null;
  const sessionStart =
    booking.bookedEntity?.slot?.startDate || null;

  if (!contactId) {
    console.error("events.js: no contactId on booking", bookingId);
    return;
  }

  // Look up the memberId from the contactId
  let memberId = null;
  try {
    const member = await members.getMember(contactId, {
      fieldsets: ["PUBLIC"],
    });
    memberId = member?._id || null;
  } catch (err) {
    console.error("events.js: member lookup failed", err.message);
  }

  if (!memberId) {
    // Not a member, no points to settle
    return;
  }

  let spiSecret;
  try {
    spiSecret = await getSecret("LLG_SPI_SECRET");
  } catch (err) {
    console.error("events.js: secret error", err.message);
    return;
  }

  try {
    const res = await fetch(SETTLE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SPI-Secret": spiSecret,
      },
      body: JSON.stringify({
        memberId,
        bookingId,
        serviceId,
        sessionStart,
        contactId,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("events.js: settle-points failed", res.status, text);
    }
  } catch (err) {
    console.error("events.js: settle-points error", err.message);
  }
}
