// ────────────────────────────────────────────────────────────
// PAGE CODE for the app-home-test page (CURRENT — no login button)
//
// This is the working version (proven on iPhone, 2026-09-25).
// The page has no embed box, just a #loginMessage text element.
// It gets the pass and redirects the whole web view to Netlify.
//
// Paste into: Wix Editor → app-home-test page → { } code panel
//
// When #loginButton is added to the page in Wix, switch to
// page-code-with-login-button.js instead.
// ────────────────────────────────────────────────────────────

import { getEmbedPass } from "backend/embedPass.web";
import wixLocation from "wix-location";

$w.onReady(async function () {
  const loginMsg = $w("#loginMessage");

  loginMsg.hide();

  try {
    const pass = await getEmbedPass();

    if (!pass) {
      loginMsg.show(); loginMsg.text = "Please log in to access the app.";
      return;
    }

    const booked = wixLocation.query.booked === "1" ? "&booked=1" : "";
    const portal = wixLocation.query.portal === "1" ? "&portal=1" : "";
    wixLocation.to(`https://llg-app-test.netlify.app/home/#p=${pass}${booked}${portal}`);
  } catch (err) {
    loginMsg.show(); loginMsg.text = "Something went wrong. Please try again.";
  }
});
