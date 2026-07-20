import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const component = await readFile(resolve(root, "src/CompactPanelDeck.jsx"), "utf8");
const styles = await readFile(resolve(root, "src/compact-panel-deck.css"), "utf8");
const settings = await readFile(resolve(root, "src/AccountSettings.jsx"), "utf8");
const settingsStyles = await readFile(resolve(root, "src/account-settings.css"), "utf8");

function includes(source, value, message) {
  assert.ok(source.includes(value), message);
}

for (const exportedName of [
  "CompactPanelDeck",
  "CompactPanel",
  "CompactPanelHeader",
  "CompactPanelBody",
  "CompactDisclosureGroup",
  "CompactDisclosure",
]) {
  includes(component, exportedName, `${exportedName} must remain part of the reusable component API.`);
}

includes(component, 'role="region"', "The horizontal rail must be exposed as a labeled region.");
includes(component, "aria-label={ariaLabel}", "The rail must use the caller's descriptive label.");
includes(component, "tabIndex={0}", "The rail must be keyboard focusable.");
includes(component, "event.target !== event.currentTarget", "Rail shortcuts must run only when the rail itself has focus.");
includes(component, "event.defaultPrevented", "Rail shortcuts must honor already-handled keyboard events.");
for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
  includes(component, `\"${key}\"`, `The rail must support ${key}.`);
}
includes(component, "prefersReducedMotion() ? \"auto\" : \"smooth\"", "Programmatic alignment must respect reduced motion.");
includes(component, "aria-expanded={isOpen}", "Disclosure buttons must expose their expanded state.");
includes(component, "aria-controls={contentId}", "Disclosure buttons must control a unique content region.");
includes(component, "useId()", "Deck headings and disclosures must use instance-safe IDs.");
includes(component, 'role={ariaLabel ? "group" : undefined}', "Labeled disclosure collections must be groups.");
assert.doesNotMatch(component, /on(?:Touch|Pointer|Mouse)Move\s*=/, "The deck must not imitate native dragging.");

includes(styles, "grid-auto-columns: 87%", "Mobile panels must leave a visible next-panel peek.");
includes(styles, "grid-auto-columns: 88%", "The common 390–430px range must retain the next-panel peek.");
includes(styles, "grid-auto-columns: 89%", "The 320px range must retain the next-panel peek.");
includes(styles, "scroll-snap-type: x proximity", "Optional snapping must be proximity based.");
assert.doesNotMatch(styles, /scroll-snap-type:\s*x\s+mandatory/, "Mandatory scroll snapping is not allowed.");
includes(styles, "scroll-snap-align: start", "Each panel must align to the rail start.");
includes(styles, "overscroll-behavior-inline: contain", "Only horizontal overscroll should be contained.");
includes(styles, "overscroll-behavior-block: auto", "Contained panels must allow vertical scroll chaining.");
includes(styles, "100dvh", "Contained panels must account for the dynamic viewport.");
includes(styles, "overflow-y: auto", "Contained panel bodies must own their vertical overflow.");
includes(styles, "scrollbar-width: thin", "Scrollable areas must retain a visible scrollbar affordance.");
includes(styles, '@media (prefers-reduced-motion: reduce)', "Reduced-motion styles must be present.");
includes(styles, 'html:not([data-layout-mode="full"])', "The existing Full layout switch must bypass mobile deck conversion.");
assert.doesNotMatch(styles, /touch-action\s*:/, "Native scrolling and pinch zoom must not be restricted.");
assert.doesNotMatch(styles, /overflow-x\s*:\s*hidden/, "The component must not hide horizontal layout defects.");
assert.doesNotMatch(styles, /display\s*:\s*contents/, "Semantic disclosure regions must not use display: contents.");
assert.doesNotMatch(styles, /(^|})\s*(?:html|body|#root)\s*\{/m, "The component must not add global page-shell rules.");

for (const panelId of ["profile", "assistant", "controls", "account"]) {
  includes(settings, `id=\"${panelId}\"`, `Account Settings must opt the ${panelId} group into the deck.`);
}
includes(settings, 'bodyScroll="contained"', "At least one dense Settings panel must exercise contained scrolling.");
includes(settings, 'bodyScroll="document"', "Normal Settings panels must exercise document scrolling.");
includes(settings, "desktopActiveId={section}", "Existing desktop tab selection must remain authoritative.");
includes(settings, "saveAccountSettings(scope", "Existing Settings persistence must remain connected.");
includes(settingsStyles, ".account-settings-card > .compact-disclosure-content > label", "Existing direct-child field styling must survive the wrapper.");
includes(settingsStyles, ".account-action-stack > .compact-disclosure-content > div", "Existing account status row styling must survive the wrapper.");

console.log("CompactPanelDeck contract passed: reusable API, mobile rail, disclosures, scroll safety, Full-mode bypass, and Account Settings integration are present.");
