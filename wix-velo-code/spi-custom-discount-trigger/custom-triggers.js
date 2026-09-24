// ────────────────────────────────────────────────────────────
// FILE: src/backend/__spi__/ecom-discounts-trigger/custom-triggers.js
//
// In the Wix Editor, create this file at:
//   backend/__spi__/ecom-discounts-trigger/custom-triggers.js
//
// Verified by live test 2026-09-24:
//   context.identity.memberId ✓
//   @wix/pricing-plans + auth.elevate() ✓
//   Fires in Wix app checkout ✓
//   Stacks with manual coupon codes ✓
// ────────────────────────────────────────────────────────────

import { orders } from "@wix/pricing-plans";
import { auth } from "@wix/essentials";

// Plan IDs that qualify for the £7.50 group coaching discount
const ELIGIBLE_PLAN_IDS = [
  "530c7704-3e17-4f8f-bc5a-5ceec84ae16c", // Physical membership
  "00478766-f484-40f0-9d4a-1fb329b54da5", // Complete membership
];

const TRIGGER_ID = "llg-member-coaching-discount";

export const listTriggers = async () => {
  return {
    customTriggers: [
      {
        _id: TRIGGER_ID,
        name: "LLG Member Coaching Discount",
      },
    ],
  };
};

export const getEligibleTriggers = async (options, context) => {
  const memberId = context?.identity?.memberId;

  if (!memberId) {
    return { eligibleTriggers: [] };
  }

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

    if (!hasEligiblePlan) {
      return { eligibleTriggers: [] };
    }

    const eligible = (options.triggers || [])
      .filter((t) => t.customTrigger?._id === TRIGGER_ID)
      .map((t) => ({
        customTriggerId: t.customTrigger._id,
        identifier: t.identifier,
      }));

    return { eligibleTriggers: eligible };
  } catch (err) {
    console.error("SPI getEligibleTriggers error:", err.message || err);
    return { eligibleTriggers: [] };
  }
};
