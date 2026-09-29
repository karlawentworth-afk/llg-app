// ────────────────────────────────────────────────────────────
// Backend web module: checkoutSession.web.js
//
// Paste into Velo > Backend > checkoutSession.web.js
//
// Creates a booking for a specific slot, then creates an
// eCommerce checkout, and returns the checkout URL.
//
// Called from the app-checkout page as the logged-in member
// (SiteMember permission). The member's identity flows through
// to the booking and checkout, so discount triggers get her
// member ID.
//
// Packages: wix-bookings.v2, wix-ecom-backend, wix-members-backend
// ────────────────────────────────────────────────────────────

import { bookings } from "wix-bookings.v2";
import { checkout } from "wix-ecom-backend";
import { currentMember } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";
import { elevate } from "wix-auth";

const BOOKINGS_APP_ID = "13d21c63-b5ec-5912-8397-c3a5ddb27a97";

export const createCheckoutSession = webMethod(
  Permissions.SiteMember,
  async (slotParams) => {
    try {
      // 1. Get the current member's details
      const member = await currentMember.getMember({ fieldsets: ["FULL"] });
      if (!member) {
        return { error: "not_logged_in" };
      }

      const contactId = member.contactId;
      const firstName = member.contactDetails?.firstName || "";
      const lastName = member.contactDetails?.lastName || "";
      const email = member.loginEmail || "";
      const phone = member.contactDetails?.phones?.[0] || "";

      // 2. Create the booking
      const bookingData = {
        bookedEntity: {
          slot: {
            serviceId: slotParams.serviceId,
            startDate: slotParams.startDate,
            endDate: slotParams.endDate || undefined,
            timezone: slotParams.timezone || "Europe/London",
          },
        },
        contactDetails: {
          contactId,
          firstName,
          lastName,
          email,
          phone,
        },
        totalParticipants: 1,
        selectedPaymentOption: "ONLINE",
      };

      // Add optional fields if provided
      if (slotParams.scheduleId) {
        bookingData.bookedEntity.slot.scheduleId = slotParams.scheduleId;
      }
      if (slotParams.resourceId) {
        bookingData.bookedEntity.slot.resource = { _id: slotParams.resourceId };
      }
      if (slotParams.eventId) {
        bookingData.bookedEntity.slot.eventId = slotParams.eventId;
      }

      const elevatedCreateBooking = elevate(bookings.createBooking);
      const bookingResult = await elevatedCreateBooking(bookingData);
      const bookingId = bookingResult.booking._id;

      if (!bookingId) {
        return { error: "booking_creation_failed" };
      }

      // 3. Create eCommerce checkout
      const elevatedCreateCheckout = elevate(checkout.createCheckout);
      const checkoutResult = await elevatedCreateCheckout({
        lineItems: [
          {
            catalogReference: {
              appId: BOOKINGS_APP_ID,
              catalogItemId: bookingId,
            },
            quantity: 1,
          },
        ],
        channelType: "WEB",
      });

      const checkoutId = checkoutResult._id;
      if (!checkoutId) {
        return { error: "checkout_creation_failed" };
      }

      // 4. Get checkout URL
      const elevatedGetCheckoutUrl = elevate(checkout.getCheckoutUrl);
      const urlResult = await elevatedGetCheckoutUrl(checkoutId);

      if (!urlResult?.checkoutUrl) {
        return { error: "checkout_url_failed" };
      }

      return {
        ok: true,
        checkoutUrl: urlResult.checkoutUrl,
        bookingId,
      };
    } catch (err) {
      console.error("checkoutSession error:", err.message || err);
      return {
        error: "checkout_failed",
        detail: err.message || String(err),
      };
    }
  }
);
