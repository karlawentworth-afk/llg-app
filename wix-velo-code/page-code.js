// ────────────────────────────────────────────────────────────
// PAGE CODE for the hidden "app-home-test" page
// Paste this into the page code panel (click the page in the
// editor → click the { } code icon at the bottom)
// ────────────────────────────────────────────────────────────

import { getEmbedPass } from "backend/embedPass.web";

$w.onReady(async function () {
  const loginMsg = $w("#loginMessage");
  const embed = $w("#appEmbed");

  // Hide both initially
  loginMsg.hide();
  embed.hide();

  try {
    const pass = await getEmbedPass();

    if (!pass) {
      loginMsg.text = "Please log in to access the app.";
      loginMsg.show();
      return;
    }

    embed.src = `https://llg-app-test.netlify.app/home/#p=${pass}`;
    embed.show();
  } catch (err) {
    loginMsg.text = "Something went wrong. Please try again.";
    loginMsg.show();
  }
});
