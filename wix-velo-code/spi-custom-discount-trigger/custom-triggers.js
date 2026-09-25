// ────────────────────────────────────────────────────────────
// FILE: backend/__spi__/ecom-discounts-trigger/custom-triggers.js
//
// Two triggers:
// 1. llg-member-coaching-discount: £7.50 off for Physical/Complete
// 2. llg-points-redemption: 100% off when member has a points flag
//
// Packages needed (Velo Package Manager):
//   @wix/pricing-plans, @wix/essentials
// Secrets needed (Wix Secrets Manager):
//   LLG_SPI_SECRET (same value as SPI_SECRET in Netlify env vars)
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

  try {
    // Trigger 1: Member coaching discount
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
      const memberTrigger = (options.triggers || []).find(
        (t) => t.customTrigger?._id === TRIGGER_MEMBER
      );
      if (memberTrigger) {
        eligible.push({
          customTriggerId: memberTrigger.customTrigger._id,
          identifier: memberTrigger.identifier,
        });
      }
    }

    // Trigger 2: Points redemption
    const pointsTrigger = (options.triggers || []).find(
      (t) => t.customTrigger?._id === TRIGGER_POINTS
    );

    if (pointsTrigger) {
      try {
        const spiSecret = await getSecret("LLG_SPI_SECRET");
        const res = await fetch(
          "https://llg-app-test.netlify.app/.netlify/functions/check-points-flag",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-SPI-Secret": spiSecret,
            },
            body: JSON.stringify({ memberId }),
          }
        );

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
        console.error("SPI points flag check error:", err.message || err);
      }
    }
  } catch (err) {
    console.error("SPI getEligibleTriggers error:", err.message || err);
  }

  return { eligibleTriggers: eligible };
};
