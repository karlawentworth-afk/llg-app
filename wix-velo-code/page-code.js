// ────────────────────────────────────────────────────────────
// PAGE CODE for the app-home-test page
//
// This is the working version (proven on iPhone, 2026-09-25).
// The page has no embed box, just a #loginMessage text element.
// It gets the pass and redirects the whole web view to Netlify.
//
// If the member isn't logged in, shows a login prompt button
// instead of "Something went wrong".
//
// Paste into: Wix Editor → app-home-test page → { } code panel
// ────────────────────────────────────────────────────────────

import { getEmbedPass } from "backend/embedPass.web";
import { authentication } from "wix-members-frontend";
import wixLocation from "wix-location";

$w.onReady(function () {
  const loginMsg = $w("#loginMessage");
  const loginBtn = $w("#loginButton");

  loginMsg.text = "Loading your golf...";
  loginMsg.show();
  loginBtn.hide();

  loadApp();

  async function loadApp() {
    try {
      const pass = await getEmbedPass();

      if (!pass) {
        showLogin();
        return;
      }

      wixLocation.to(`https://llg-app-test.netlify.app/home/#p=${pass}`);
    } catch (err) {
      const msg = (err && err.message) || "";
      if (msg.includes("No permission") || msg.includes("not logged in")) {
        showLogin();
      } else {
        loginMsg.text = "Something went wrong. Please try again.";
      }
    }
  }

  function showLogin() {
    loginMsg.text = "Please log in to see your golf";
    loginBtn.label = "Log in";
    loginBtn.show();
    loginBtn.onClick(function () {
      authentication.promptLogin().then(function () {
        loginBtn.hide();
        loginMsg.text = "Loading your golf...";
        loadApp();
      }).catch(function () {
        // Member closed the login form without logging in
      });
    });
  }
});
