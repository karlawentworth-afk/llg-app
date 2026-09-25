// ────────────────────────────────────────────────────────────
// FILE: backend/embedPass.web.js
// Paste this ENTIRE file into your Wix Editor:
//   Site Structure → Backend → New .web.js file → name it "embedPass"
// ────────────────────────────────────────────────────────────

import { Permissions, webMethod } from "wix-web-module";
import { currentMember } from "wix-members-backend";
import { getSecret } from "wix-secrets-backend";
import CryptoJS from "crypto-js";

function toBase64url(b64) {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const getEmbedPass = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      // Get the logged-in member on the SERVER side
      const member = await currentMember.getMember({
        fieldsets: ["FULL"],
      });

      if (!member || !member._id) {
        return null;
      }

      const secret = await getSecret("LLG_EMBED_SECRET");

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        memberId: member._id,
        contactId: member.contactId,
        firstName: member.profile?.nickname || member.profile?.firstName || "Member",
        fullName: (member.profile?.firstName || "") + (member.profile?.lastName ? " " + member.profile.lastName : ""),
        email: member.loginEmail || "",
        phone: member.profile?.phones?.[0] || "",
        iat: now,
        exp: now + 300, // 5 minutes
      };

      const jsonStr = JSON.stringify(payload);
      const wordArray = CryptoJS.enc.Utf8.parse(jsonStr);
      const payloadB64 = toBase64url(CryptoJS.enc.Base64.stringify(wordArray));
      const sig = CryptoJS.HmacSHA256(payloadB64, secret);
      const signature = toBase64url(CryptoJS.enc.Base64.stringify(sig));

      return payloadB64 + "." + signature;
    } catch (err) {
      console.error("embedPass error:", err.message);
      return null;
    }
  }
);
