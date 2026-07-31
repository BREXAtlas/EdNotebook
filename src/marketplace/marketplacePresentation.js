const STATUS_LABELS = Object.freeze({
  active: "Active",
  approved: "Approved",
  pending: "Preparing checkout",
  requested: "Requested",
  reviewing: "Under review",
  processing: "Processing",
  checkout_created: "Waiting for payment",
  payment_processing: "Payment processing",
  paid: "Payment confirmed",
  fulfilled: "Ready",
  succeeded: "Completed",
  won: "Resolved in seller's favor",
  lost: "Resolved for customer",
  warning_closed: "Warning closed",
  payment_failed: "Payment failed",
  failed: "Failed",
  declined: "Declined",
  canceled: "Canceled",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  expired: "Expired",
  revoked: "Revoked",
  disputed: "Dispute open",
  chargeback: "Chargeback",
});

export function formatMarketplaceMoney(cents, currency = "usd") {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

export function formatMarketplaceDate(value, fallback = "Not recorded") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function marketplaceStatusLabel(status) {
  return STATUS_LABELS[status] || String(status || "unknown").replaceAll("_", " ");
}

export function marketplaceStatusTone(status) {
  if (["active", "approved", "fulfilled", "paid", "succeeded", "won", "warning_closed"].includes(status)) return "is-ready";
  if (["payment_failed", "failed", "declined", "refunded", "expired", "revoked", "lost", "chargeback", "canceled"].includes(status)) return "is-closed";
  if (["disputed", "partially_refunded"].includes(status)) return "is-warning";
  return "is-pending";
}

export function marketplaceReceiptLabel(orderId) {
  const value = String(orderId || "").replaceAll("-", "").toUpperCase();
  return value ? `EDN-${value.slice(-10)}` : "Receipt pending";
}

export function hasActiveMarketplaceAccess(order, at = new Date()) {
  if (order?.entitlement_status !== "active") return false;
  if (!order.entitlement_expires_at) return true;
  return new Date(order.entitlement_expires_at).getTime() > at.getTime();
}

export function marketplaceAccessHref(order) {
  if (!hasActiveMarketplaceAccess(order)) return "";
  if (order.item_kind === "book" && order.publication_id) {
    return `#/library/book/${order.publication_id}`;
  }
  if (order.item_kind === "course" && order.course_publication_id) {
    return `#/student/${order.education_division || "university"}/course/${order.course_publication_id}`;
  }
  return "";
}

export function marketplaceAccessSummary(order) {
  if (order?.entitlement_status === "active" && order.entitlement_expires_at) {
    return `Rental access through ${formatMarketplaceDate(order.entitlement_expires_at)}`;
  }
  if (order?.entitlement_status === "active") return "Permanent marketplace access";
  if (order?.entitlement_status === "refunded") return "Access ended after the confirmed refund";
  if (order?.entitlement_status === "disputed") return "Access ended after the dispute outcome";
  if (order?.entitlement_status) return `Access ${marketplaceStatusLabel(order.entitlement_status)}`;
  return "Access begins after verified payment confirmation";
}
