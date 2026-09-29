// ────────────────────────────────────────────────────────────
// PAGE CODE for the app-checkout page
//
// SPIKE v2: Skip the Wix booking form entirely.
// Uses non-deprecated APIs: Bookings V2 + eCommerce checkout.
//
// This page is called from our app with slot details in the URL:
//   /app-checkout?serviceId=X&startDate=Y&endDate=Z&scheduleId=S
//
// It calls the backend web module (checkoutSession.web.js)
// which creates a booking and checkout as the logged-in member,
// then redirects to the Wix checkout page for payment.
//
// After payment: Wix thank-you page -> app-home-test -> Home.
//
// Create in Wix Editor:
// 1. Add a new page called "app-checkout"
// 2. Set Page Permissions to "Members Only"
// 3. Add a #statusMessage text element
// 4. Paste this code into the page's { } code panel
// 5. Paste checkoutSession.web.js into Backend
// ────────────────────────────────────────────────────────────

import { createCheckoutSession } from "backend/checkoutSession.web";
import wixLocation from "wix-location";

$w.onReady(function () {
  const msg = $w("#statusMessage");
  msg.hide();

  const query = wixLocation.query;

  const slotParams = {
    serviceId: query.serviceId || "",
    startDate: query.startDate || "",
    endDate: query.endDate || "",
    scheduleId: query.scheduleId || "",
    resourceId: query.resourceId || "",
    eventId: query.eventId || "",
    timezone: query.timezone || "Europe/London",
  };

  if (!slotParams.serviceId || !slotParams.startDate) {
    msg.show(); msg.text = "Missing booking details. Please go back and try again.";
    return;
  }

  createCheckoutSession(slotParams)
    .then(function (result) {
      if (result.error) {
        console.error("app-checkout:", result.error, result.detail || "");

        msg.show();
        if (result.error === "not_logged_in") {
          msg.text = "Please log in first.";
        } else if (result.detail && result.detail.indexOf("ALREADY_BOOKED") !== -1) {
          msg.text = "You're already booked for this session.";
        } else if (result.detail && result.detail.indexOf("FULLY_BOOKED") !== -1) {
          msg.text = "This session is now full.";
        } else {
          msg.text = "Could not set up booking: " + (result.detail || result.error);
        }

        // Return to Home after 4 seconds
        setTimeout(function () {
          wixLocation.to("/app-home-test?booked=0");
        }, 4000);
        return;
      }

      // Redirect to Wix checkout page
      msg.text = "Taking you to checkout...";
      wixLocation.to(result.checkoutUrl);
    })
    .catch(function (err) {
      console.error("app-checkout catch:", err);
      msg.show(); msg.text = "Something went wrong. Taking you back...";
      setTimeout(function () {
        wixLocation.to("/app-home-test");
      }, 3000);
    });
});
