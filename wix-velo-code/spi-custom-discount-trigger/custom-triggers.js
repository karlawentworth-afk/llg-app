// ────────────────────────────────────────────────────────────
// FILE: src/backend/__spi__/ecom-discounts-trigger/custom-triggers.js
//
// In the Wix Editor, enable Dev Mode, then create this file at:
//   src/backend/__spi__/ecom-discounts-trigger/custom-triggers.js
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
  // Log context shape once so we can verify the real field path
  console.log("SPI context keys:", JSON.stringify(Object.keys(context || {})));
  if (context?.identity) {
    console.log("SPI identity keys:", JSON.stringify(Object.keys(context.identity)));
  }

  // Docs-inferred path: context.identity.memberId
  // If this is wrong, the log above will reveal the real shape
  const memberId = context?.identity?.memberId;

  if (!memberId) {
    console.log("SPI: no memberId found, skipping discount");
    return { eligibleTriggers: [] };
  }

  console.log("SPI: checking plans for member", memberId);

  try {
    const elevatedList = auth.elevate(orders.managementListOrders);
    const result = await elevatedList({
      buyerIds: [memberId],
      orderStatuses: ["ACTIVE"],
      limit: 10,
    });

    const memberOrders = result.orders || [];
    const hasEligiblePlan = memberOrders.some((order) =>
      ELIGIBLE_PLAN_IDS.includes(order.planId)
    );

    console.log(
      "SPI: found", memberOrders.length, "active orders,",
      "eligible:", hasEligiblePlan
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
