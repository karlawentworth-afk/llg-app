// ────────────────────────────────────────────────────────────
// PAGE CODE for the app-home-test page
// Paste this into the page code panel (click the page in the
// editor, click the { } code icon at the bottom)
// ────────────────────────────────────────────────────────────

import { getEmbedPass } from "backend/embedPass.web";
import wixLocation from "wix-location";

$w.onReady(async function () {
  const loginMsg = $w("#loginMessage");

  // Show loading message
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
