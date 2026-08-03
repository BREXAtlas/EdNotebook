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

export function marketplaceReportRange(period, at = new Date()) {
  const end = new Date(at);
  const start = new Date(at);
  if (period === "month_to_date") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "year_to_date") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    const days = period === "90_days" ? 90 : 30;
    start.setDate(start.getDate() - days);
  }
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function csvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@\t\r]/u.test(text) ? `'${text}` : text;
  return /[",\r\n]/u.test(safeText) ? `"${safeText.replaceAll('"', '""')}"` : safeText;
}

export function marketplaceSalesReportCsv(report) {
  const transactions = report?.transactions || [];
  const rows = [[
    "receipt_number", "paid_at", "title", "item_kind", "access_model", "status",
    "currency", "subtotal", "tax", "customer_total", "platform_fee",
    "seller_allocation", "refunded_customer_amount",
  ]];
  for (const transaction of transactions) {
    rows.push([
      transaction.receipt_number || marketplaceReceiptLabel(transaction.id),
      transaction.paid_at || "",
      transaction.title_snapshot || "",
      transaction.item_kind || "",
      transaction.access_model || "",
      transaction.status || "",
      String(transaction.currency || "usd").toUpperCase(),
      (Number(transaction.subtotal_cents || 0) / 100).toFixed(2),
      (Number(transaction.tax_cents || 0) / 100).toFixed(2),
      (Number(transaction.total_cents || 0) / 100).toFixed(2),
      (Number(transaction.platform_fee_cents || 0) / 100).toFixed(2),
      (Number(transaction.seller_net_cents || 0) / 100).toFixed(2),
      (Number(transaction.refunded_cents || 0) / 100).toFixed(2),
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadMarketplaceSalesReport(report) {
  const csv = marketplaceSalesReportCsv(report);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const start = String(report?.period?.start_at || "sales").slice(0, 10);
  const end = String(report?.period?.end_at || "report").slice(0, 10);
  anchor.href = href;
  anchor.download = `ednotebook-sales-${start}-to-${end}.csv`;
  anchor.click();
  URL.revokeObjectURL(href);
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
