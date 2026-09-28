// ────────────────────────────────────────────────────────────
// PAGE CODE for the Wix Bookings and Events thank-you pages
//
// Use this on BOTH:
//   - The Bookings thank-you page
//   - The Events thank-you page
//
// Elements needed on each page:
//   #thankYouMessage — text element
//   #backButton — button element
//
// Paste into: Wix Editor → thank-you page → { } code panel
// ────────────────────────────────────────────────────────────

import wixLocation from "wix-location";

$w.onReady(function () {
  const msg = $w("#thankYouMessage");
  const btn = $w("#backButton");

  msg.text = "You're booked! Taking you back to your golf...";
  msg.show();

  btn.label = "Back to your golf";
  btn.show();
  btn.onClick(function () {
    wixLocation.to("/app-home-test?booked=1");
  });

  // Auto-redirect after 3 seconds
  setTimeout(function () {
    wixLocation.to("/app-home-test?booked=1");
  }, 3000);
});
