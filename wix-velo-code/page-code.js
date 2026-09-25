// ────────────────────────────────────────────────────────────
// PAGE CODE for the app-home-test page
//
// This is the working version (proven on iPhone, 2026-09-25).
// The page has no embed box, just a #loginMessage text element.
// It gets the pass and redirects the whole web view to Netlify.
//
// Paste into: Wix Editor → app-home-test page → { } code panel
// ────────────────────────────────────────────────────────────

import { getEmbedPass } from "backend/embedPass.web";
import wixLocation from "wix-location";

$w.onReady(async function () {
  const loginMsg = $w("#loginMessage");

  loginMsg.text = "Loading your golf...";
  loginMsg.show();

  try {
    const pass = await getEmbedPass();

    if (!pass) {
      loginMsg.text = "Please log in to access the app.";
      return;
    }

    wixLocation.to(`https://llg-app-test.netlify.app/home/#p=${pass}`);
  } catch (err) {
    loginMsg.text = "Something went wrong. Please try again.";
  }
});
