// ────────────────────────────────────────────────────────────
// PAGE CODE for the app-book page (members only)
//
// This page is set to "Members Only" in Wix. When a non-logged-in
// visitor hits it, Wix automatically shows the login lightbox.
//
// It reads the booking query parameters passed from our app and
// forwards to /booking-form with the same parameters. This ensures
// the member is logged into Wix before reaching checkout.
//
// Create in Wix Editor:
// 1. Add a new page called "app-book"
// 2. Set Page Permissions to "Members Only"
// 3. The page needs no visible elements (it redirects immediately)
// 4. Paste this code into the page's { } code panel
// ────────────────────────────────────────────────────────────

import wixLocation from "wix-location";

$w.onReady(function () {
  const query = wixLocation.query;

  // Build booking-form URL preserving all parameters
  const params = new URLSearchParams();
  Object.keys(query).forEach(function (key) {
    params.set(key, query[key]);
  });

  const bookingUrl = "/booking-form?" + params.toString();
  wixLocation.to(bookingUrl);
});
