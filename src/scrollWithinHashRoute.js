export function scrollWithinHashRoute(event, targetId, options = {}) {
  event?.preventDefault?.();
  const target = document.getElementById(targetId);
  if (!target) return false;
  const reduceMotion = globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: options.block || "start",
  });
  if (target.hasAttribute("tabindex")) target.focus({ preventScroll: true });
  return true;
}
