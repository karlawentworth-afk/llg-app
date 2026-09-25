// ────────────────────────────────────────────────────────────
// FILE: backend/__spi__/ecom-discounts-trigger/custom-triggers.js
//
// Two independent triggers:
// 1. llg-member-coaching-discount: £7.50 off for Physical/Complete
// 2. llg-points-redemption: 100% off when member has a points flag
//
// Each trigger fails safely without affecting the other.
// The points fetch times out after 2 seconds.
//
// Packages: @wix/pricing-plans, @wix/essentials
// Secrets: LLG_SPI_SECRET
// ────────────────────────────────────────────────────────────

import { orders } from "@wix/pricing-plans";
import { auth } from "@wix/essentials";
import { getSecret } from "wix-secrets-backend";
import { fetch } from "wix-fetch";

const ELIGIBLE_PLAN_IDS = [
  "530c7704-3e17-4f8f-bc5a-5ceec84ae16c", // Physical membership
  "00478766-f484-40f0-9d4a-1fb329b54da5", // Complete membership
];

const TRIGGER_MEMBER = "llg-member-coaching-discount";
const TRIGGER_POINTS = "llg-points-redemption";

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

  // Trigger 1: Member coaching discount (independent)
  try {
    const elevatedList = auth.elevate(orders.managementListOrders);
    const result = await elevatedList({
      buyerIds: [memberId],
      orderStatuses: ["ACTIVE"],
      limit: 10,
    });

    const hasEligiblePlan = (result.orders || []).some((order) =>
      ELIGIBLE_PLAN_IDS.includes(order.planId)
    );

    if (hasEligiblePlan) {
      const t = (options.triggers || []).find(
        (t) => t.customTrigger?._id === TRIGGER_MEMBER
      );
      if (t) {
        eligible.push({
          customTriggerId: t.customTrigger._id,
          identifier: t.identifier,
        });
      }
    }
  } catch (err) {
    console.error("SPI member trigger error:", err.message || err);
  }

  // Trigger 2: Points redemption (independent, 2s timeout)
  try {
    const pointsTrigger = (options.triggers || []).find(
      (t) => t.customTrigger?._id === TRIGGER_POINTS
    );

    if (pointsTrigger) {
      const spiSecret = await getSecret("LLG_SPI_SECRET");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);

      try {
        const res = await fetch(
          "https://llg-app-test.netlify.app/.netlify/functions/check-points-flag",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-SPI-Secret": spiSecret,
            },
            body: JSON.stringify({ memberId }),
            signal: controller.signal,
          }
        );
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          if (data.hasFlag) {
            eligible.push({
              customTriggerId: pointsTrigger.customTrigger._id,
              identifier: pointsTrigger.identifier,
            });
          }
        }
      } catch (fetchErr) {
        clearTimeout(timer);
        console.error("SPI points fetch error:", fetchErr.message || fetchErr);
      }
    }
  } catch (err) {
    console.error("SPI points trigger error:", err.message || err);
  }

  return { eligibleTriggers: eligible };
};
