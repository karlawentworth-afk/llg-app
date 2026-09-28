// ────────────────────────────────────────────────────────────
// PAGE CODE for the app-checkout page
//
// SPIKE: Skip the Wix booking form entirely.
//
// This page is called from our app with slot details in the URL:
//   /app-checkout?serviceId=X&startDate=Y&endDate=Z&resourceId=R
//
// It calls checkoutBooking() which handles payment inline.
// The member is already logged in on Wix, so the member discount
// and points triggers get her member ID.
//
// After payment: Wix redirects to the thank-you page, which
// redirects back to our app.
//
// Create in Wix Editor:
// 1. Add a new page called "app-checkout"
// 2. Add a #statusMessage text element
// 3. Paste this code into the page's { } code panel
// 4. Set page to "Members Only" (ensures login)
//
// Packages: wix-bookings-frontend, wix-location
// ────────────────────────────────────────────────────────────

import wixBookingsFrontend from "wix-bookings-frontend";
import wixLocation from "wix-location";

$w.onReady(function () {
  const msg = $w("#statusMessage");
  msg.text = "Setting up your booking...";
  msg.show();

  const query = wixLocation.query;
  const serviceId = query.serviceId;
  const startDate = query.startDate;
  const endDate = query.endDate;
  const resourceId = query.resourceId || undefined;
  const timezone = query.timezone || "Europe/London";

  if (!serviceId || !startDate) {
    msg.text = "Missing booking details. Please go back and try again.";
    return;
  }

  // Build the slot object
  const slot = {
    serviceId,
    startDate,
    endDate: endDate || undefined,
    timezone,
  };

  if (resourceId) {
    slot.resource = { id: resourceId };
  }

  // Call checkoutBooking — this opens the Wix payment popup
  // The member is already logged in, so discounts apply
  wixBookingsFrontend
    .checkoutBooking({
      slot,
      // No form fields needed — Wix uses the logged-in member's details
    })
    .then(function (result) {
      // Payment complete — Wix handles the redirect to thank-you
      msg.text = "You're booked!";
    })
    .catch(function (err) {
      const errMsg = err.message || String(err);
      console.error("app-checkout error:", errMsg);

      if (errMsg.includes("ALREADY_BOOKED") || errMsg.includes("already booked")) {
        msg.text = "You're already booked for this session.";
      } else if (errMsg.includes("FULLY_BOOKED") || errMsg.includes("fully booked")) {
        msg.text = "This session is now full. Please go back and choose another.";
      } else if (errMsg.includes("canceled") || errMsg.includes("cancelled")) {
        msg.text = "Payment was cancelled.";
      } else {
        msg.text = "Something went wrong: " + errMsg;
      }

      // Show a back button after error
      setTimeout(function () {
        wixLocation.to("/app-home-test");
      }, 4000);
    });
});
