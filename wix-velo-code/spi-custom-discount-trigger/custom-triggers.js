// ────────────────────────────────────────────────────────────
// Two independent triggers:
// 1. llg-member-coaching-discount: £7.50 off for Physical/Complete
// 2. llg-points-redemption: 100% off when member has a points flag
//
// Each trigger fails safely without affecting the other.
// The points fetch times out after 2 seconds via Promise.race.
//
// Packages: @wix/pricing-plans, @wix/essentials
// Secrets: LLG_SPI_SECRET
// ────────────────────────────────────────────────────────────

import { orders } from "@wix/pricing-plans";
import { auth } from "@wix/essentials";
import { getSecret } from "wix-secrets-backend";
import { fetch } from "wix-fetch";

const ELIGIBLE_PLAN_IDS = [
  "530c7704-3e17-4f8f-bc5a-5ceec84ae16c",
  "00478766-f484-40f0-9d4a-1fb329b54da5",
];

const TRIGGER_MEMBER = "llg-member-coaching-discount";
const TRIGGER_POINTS = "llg-points-redemption";

function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
}

export const listTriggers = async () => {
  return {
    customTriggers: [
      { _id: TRIGGER_MEMBER, name: "LLG Member Coaching Discount" },
      { _id: TRIGGER_POINTS, name: "LLG Points Redemption" },
    ],
  };
};

export const getEligibleTriggers = async (options, context) => {
  const memberId = context?.identity?.memberId;
  if (!memberId) return { eligibleTriggers: [] };

  const eligible = [];

  // Trigger 1: Member coaching discount
  try {
    const memberTrigger = (options.triggers || []).find(
      (tr) => tr.customTrigger?._id === TRIGGER_MEMBER
    );

    const elevatedList = auth.elevate(orders.managementListOrders);
    const result = await elevatedList({
      buyerIds: [memberId],
      orderStatuses: ["ACTIVE"],
      limit: 10,
    });

    const orderCount = (result.orders || []).length;
    const matchedPlanIds = (result.orders || [])
      .filter((o) => ELIGIBLE_PLAN_IDS.includes(o.planId))
      .map((o) => o.planId);
    const hasEligiblePlan = matchedPlanIds.length > 0;

    if (hasEligiblePlan && memberTrigger) {
      eligible.push({
        customTriggerId: memberTrigger.customTrigger._id,
        identifier: memberTrigger.identifier,
      });
    }

    // Beacon: fire and forget (1s timeout, never blocks checkout)
    try {
      const debugSecret = await getSecret("LLG_SPI_SECRET").catch(() => null);
      if (debugSecret) {
        Promise.race([
          fetch(
            "https://llg-app-test.netlify.app/.netlify/functions/spi-debug",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-SPI-Secret": debugSecret,
              },
              body: JSON.stringify({
                step: "member_trigger",
                hasMemberId: true,
                memberTriggerInOptions: !!memberTrigger,
                triggerIds: (options.triggers || []).map(
                  (tr) => tr.customTrigger?._id || "unknown"
                ),
                orderCount,
                matchedPlanIds,
                eligible: hasEligiblePlan && !!memberTrigger,
              }),
            }
          ),
          timeout(1000),
        ]).catch(() => {});
      }
    } catch (e) {}
  } catch (err) {
    // Beacon the error too
    try {
      const debugSecret = await getSecret("LLG_SPI_SECRET").catch(() => null);
      if (debugSecret) {
        Promise.race([
          fetch(
            "https://llg-app-test.netlify.app/.netlify/functions/spi-debug",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-SPI-Secret": debugSecret,
              },
              body: JSON.stringify({
                step: "member_trigger_error",
                error: err.message || String(err),
              }),
            }
          ),
          timeout(1000),
        ]).catch(() => {});
      }
    } catch (e2) {}
    console.error("SPI member trigger error:", err.message || err);
  }

  // Trigger 2: Points redemption (2s timeout, fully independent)
  try {
    const pointsTrigger = (options.triggers || []).find(
      (tr) => tr.customTrigger?._id === TRIGGER_POINTS
    );

    if (pointsTrigger) {
      let spiSecret;
      try {
        spiSecret = await getSecret("LLG_SPI_SECRET");
      } catch (err) {
        console.error("SPI secret error:", err.message || err);
      }

      if (spiSecret) {
        try {
          const res = await Promise.race([
            fetch(
              "https://llg-app-test.netlify.app/.netlify/functions/check-points-flag",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-SPI-Secret": spiSecret,
                },
                body: JSON.stringify({ memberId }),
              }
            ),
            timeout(2000),
          ]);

          if (res.ok) {
            const data = await res.json();
            if (data.hasFlag) {
              eligible.push({
                customTriggerId: pointsTrigger.customTrigger._id,
                identifier: pointsTrigger.identifier,
              });
            }
          }
        } catch (err) {
          console.error("SPI points fetch error:", err.message || err);
        }
      }
    }
  } catch (err) {
    console.error("SPI points trigger error:", err.message || err);
  }

  return { eligibleTriggers: eligible };
};
