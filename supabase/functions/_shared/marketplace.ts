import Stripe from "npm:stripe@22.1.1";
import { HttpError } from "./runtime.ts";

const TRUSTED_HOSTS = new Set([
  "ednotebook.com",
  "www.ednotebook.com",
  "brexatlas.github.io",
  "localhost",
  "127.0.0.1",
]);

export function stripeId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

export function trustedMarketplaceUrl(value: unknown, fallbackPath: string): string {
  const configured = Deno.env.get("MARKETPLACE_RETURN_URL");
  const candidate = typeof value === "string" && value.trim()
    ? value.trim()
    : configured || `https://ednotebook.com/staging/${fallbackPath}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new HttpError(400, "Marketplace return address is invalid.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!TRUSTED_HOSTS.has(url.hostname) || (!local && url.protocol !== "https:")) {
    throw new HttpError(400, "Marketplace return address is not trusted.");
  }
  return url.href;
}

export function stripeClient(): Stripe {
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) throw new HttpError(503, "Stripe Connect is not configured.");
  return new Stripe(secret, { telemetry: false });
}

export function marketplaceFee(priceCents: number, basisPoints: number): number {
  return Math.max(0, Math.min(priceCents, Math.round(priceCents * basisPoints / 10_000)));
}

export function verifiedSeller(account: Stripe.Account): boolean {
  const due = account.requirements?.currently_due || [];
  const disabledReason = account.requirements?.disabled_reason;
  return Boolean(
    account.details_submitted
    && account.charges_enabled
    && account.payouts_enabled
    && due.length === 0
    && !disabledReason,
  );
}

export function sellerRequirementSummary(account: Stripe.Account): string[] {
  return [
    ...(account.requirements?.currently_due || []),
    ...(account.requirements?.past_due || []),
  ].filter((value, index, all) => all.indexOf(value) === index).slice(0, 100);
}
