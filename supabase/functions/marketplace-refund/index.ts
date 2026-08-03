import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  adminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  parseJson,
  preflight,
  requirePost,
  requireUser,
} from "../_shared/runtime.ts";
import { stripeClient } from "../_shared/marketplace.ts";
import { recordAuditRequired } from "../_shared/security.ts";

interface RefundRequest {
  refundRequestId?: string;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  const admin = adminClient();
  try {
    requirePost(req);
    const { user } = await requireUser(req);
    const input = await parseJson<RefundRequest>(req, 20_000);
    if (!input.refundRequestId) throw new HttpError(400, "Refund request identifier is required.");

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "owner") {
      throw new HttpError(403, "Only the platform owner can send an approved refund to Stripe.");
    }
    const { data: refundRequest, error: requestError } = await admin
      .from("marketplace_refund_requests")
      .select("*")
      .eq("id", input.refundRequestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!refundRequest || refundRequest.status !== "approved") {
      throw new HttpError(409, "The refund must be approved before processor submission.");
    }
    const { data: order, error: orderError } = await admin
      .from("marketplace_orders")
      .select("*")
      .eq("id", refundRequest.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order?.stripe_payment_intent_id || !["paid", "fulfilled", "partially_refunded"].includes(order.status)) {
      throw new HttpError(409, "The order is not eligible for a processor refund.");
    }
    const remaining = order.total_cents - order.refunded_cents;
    if (refundRequest.amount_cents > remaining) {
      throw new HttpError(409, "The approved refund exceeds the remaining paid amount.");
    }

    await admin.from("marketplace_refund_requests")
      .update({ status: "processing", failure_summary: null })
      .eq("id", refundRequest.id)
      .eq("status", "approved");

    const stripe = stripeClient();
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: refundRequest.amount_cents,
      reverse_transfer: true,
      refund_application_fee: Boolean(order.stripe_application_fee_id),
      reason: "requested_by_customer",
      metadata: {
        ednotebook_refund_request_id: refundRequest.id,
        ednotebook_order_id: order.id,
      },
    }, { idempotencyKey: `ednotebook-marketplace-refund:${refundRequest.id}` });

    await admin.from("marketplace_refund_requests").update({
      stripe_refund_id: refund.id,
      status: "processing",
      processed_at: null,
    }).eq("id", refundRequest.id);

    await recordAuditRequired(admin, req, {
      actorId: user.id,
      eventType: "marketplace.refund_submitted",
      targetType: "marketplace_refund_request",
      targetId: refundRequest.id,
      details: {
        orderId: order.id,
        amountCents: refundRequest.amount_cents,
        stripeStatus: refund.status,
      },
    });
    return jsonResponse(req, {
      refundRequestId: refundRequest.id,
      status: refund.status,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
