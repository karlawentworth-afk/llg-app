// ────────────────────────────────────────────────────────────
// FILE: src/backend/__spi__/ecom-discounts-trigger/custom-triggers.js
//
// In the Wix Editor, enable Dev Mode, then create this file at:
//   src/backend/__spi__/ecom-discounts-trigger/custom-triggers.js
// ────────────────────────────────────────────────────────────

import { orders } from "wix-pricing-plans-backend";

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

  // Not logged in — no discount
  if (!memberId) {
    return { eligibleTriggers: [] };
  }

  try {
    // Fetch member's pricing plan orders, active only
    const result = await orders.memberOrdersList(memberId, {
      orderStatuses: ["ACTIVE"],
    });

    const hasEligiblePlan = (result.orders || []).some((order) =>
      ELIGIBLE_PLAN_IDS.includes(order.planId)
    );

    if (!hasEligiblePlan) {
      return { eligibleTriggers: [] };
    }

    // Return all requested triggers that match our ID
    const eligible = (options.triggers || [])
      .filter((t) => t.customTrigger?._id === TRIGGER_ID)
      .map((t) => ({
        customTriggerId: t.customTrigger._id,
        identifier: t.identifier,
      }));

    return { eligibleTriggers: eligible };
  } catch {
    // On any error, don't block checkout — just skip the discount
    return { eligibleTriggers: [] };
  }
};
