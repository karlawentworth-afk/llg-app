// ────────────────────────────────────────────────────────────
// FILE: backend/embedPass.web.js
// Paste this ENTIRE file into your Wix Editor:
//   Site Structure → Backend → New .web.js file → name it "embedPass"
// ────────────────────────────────────────────────────────────

import { Permissions, webMethod } from "wix-web-module";
import { currentMember } from "wix-members-backend";
import { getSecret } from "wix-secrets-backend";

// Base64url encode helper
function base64urlEncode(str) {
  // Wix backend runs Node-like JS, btoa is available
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// HMAC-SHA256 using SubtleCrypto (available in Wix backend)
async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  // Convert ArrayBuffer to base64url
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64urlEncode(binary);
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
        iat: now,
        exp: now + 300, // 5 minutes
      };

      const payloadB64 = base64urlEncode(JSON.stringify(payload));
      const signature = await hmacSha256(secret, payloadB64);

      return payloadB64 + "." + signature;
    } catch (err) {
      console.error("embedPass error");
      return null;
    }
  }
);
