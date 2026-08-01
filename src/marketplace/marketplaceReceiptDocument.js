import { formatMarketplaceDate, formatMarketplaceMoney } from "./marketplacePresentation.js";

export function marketplaceReceiptLines(receipt) {
  const refunded = Number(receipt?.refunded_cents || 0);
  const lines = [
    "EdNotebook · Alex B. Morrison Library & Bookstore",
    "Transaction receipt",
    `Receipt: ${receipt?.receipt_number || "Pending"}`,
    `Issued: ${formatMarketplaceDate(receipt?.issued_at)}`,
    "",
    `Item: ${receipt?.title_snapshot || "Library item"}`,
    `Seller: ${receipt?.seller_name || "EdNotebook marketplace seller"}`,
    `Access: ${receipt?.access_model === "rental" ? `${receipt?.rental_days || "Time-limited"} day rental` : "Permanent purchase"}`,
    `Status: ${String(receipt?.order_status || "unknown").replaceAll("_", " ")}`,
    "",
    `Subtotal: ${formatMarketplaceMoney(receipt?.subtotal_cents, receipt?.currency)}`,
    `Tax: ${formatMarketplaceMoney(receipt?.tax_cents, receipt?.currency)}`,
    `Total: ${formatMarketplaceMoney(receipt?.total_cents, receipt?.currency)}`,
  ];
  if (refunded > 0) lines.push(`Refunded: ${formatMarketplaceMoney(refunded, receipt?.currency)}`);
  lines.push(
    "",
    "Payment was processed by Stripe. This EdNotebook record confirms the marketplace transaction and learning access; it is not a tax invoice.",
  );
  return lines;
}

export async function downloadMarketplaceReceiptPdf(receipt) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const lines = marketplaceReceiptLines(receipt);
  pdf.setProperties({
    title: `${receipt?.receipt_number || "EdNotebook"} transaction receipt`,
    subject: "EdNotebook marketplace transaction receipt",
    creator: "EdNotebook",
  });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(lines[0], 54, 62);
  pdf.setFontSize(12);
  pdf.text(lines[1], 54, 84);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  let y = 112;
  for (const line of lines.slice(2)) {
    const wrapped = pdf.splitTextToSize(line || " ", 500);
    pdf.text(wrapped, 54, y);
    y += Math.max(15, wrapped.length * 13);
  }
  pdf.save(`${receipt?.receipt_number || "ednotebook-receipt"}.pdf`);
}
