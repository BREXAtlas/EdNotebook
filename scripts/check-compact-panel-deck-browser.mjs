import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const resultsDirectory = resolve(root, "test-results");
await mkdir(resultsDirectory, { recursive: true });

const server = await createServer({
  root,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});

let browser;

async function openProfessorSettings(page) {
  await page.goto(`${origin}/#/tour/professor`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Close tour", exact: true }).click();
  const baselineOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  await page.locator(".sidebar-settings-button").click();
  await page.locator(".compact-panel-deck").waitFor({ state: "visible" });
  return baselineOverflow;
}

async function desktopCheck(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openProfessorSettings(page);

  const layout = await page.evaluate(() => {
    const deck = document.querySelector(".compact-panel-deck");
    const panels = [...deck.querySelectorAll(":scope > .compact-panel")];
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      deckDisplay: getComputedStyle(deck).display,
      deckOverflowX: getComputedStyle(deck).overflowX,
      deckWidth: deck.clientWidth,
      deckScrollWidth: deck.scrollWidth,
      visiblePanels: panels.filter((panel) => panel.getClientRects().length).map((panel) => panel.dataset.panelId),
      visibleDisclosureButtons: [...deck.querySelectorAll(".compact-disclosure-trigger")]
        .filter((button) => getComputedStyle(button).display !== "none").length,
      visibleCards: [...deck.querySelectorAll(".account-settings-card")]
        .filter((card) => card.getClientRects().length).length,
    };
  });

  assert.equal(layout.documentOverflow, 0, "Desktop Settings must not widen the document.");
  assert.equal(layout.deckDisplay, "block", "Desktop must retain the existing non-rail layout.");
  assert.equal(layout.deckOverflowX, "visible", "Desktop must not introduce horizontal scrolling.");
  assert.equal(layout.deckScrollWidth, layout.deckWidth, "Desktop deck must not overflow.");
  assert.deepEqual(layout.visiblePanels, ["profile"], "Only the selected desktop Settings panel should render visually.");
  assert.equal(layout.visibleDisclosureButtons, 0, "Desktop must retain its existing visible card headings.");
  assert.equal(layout.visibleCards, 2, "Desktop must retain the existing two-card Settings grid.");

  const displayName = page.getByRole("textbox", { name: "Display name" });
  await displayName.fill("Atlas responsive test");
  await page.getByRole("button", { name: "Save profile on this device" }).click();
  await page.getByRole("status").waitFor({ state: "visible" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Close tour", exact: true }).click();
  await page.locator(".sidebar-settings-button").click();
  assert.equal(
    await page.getByRole("textbox", { name: "Display name" }).inputValue(),
    "Atlas responsive test",
    "Existing Settings persistence must survive the wrapper and a reload.",
  );

  await page.locator(".account-settings-shell").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(resultsDirectory, "compact-panel-deck-desktop.png") });
  await page.close();
}

async function mobileCheck(context, viewport) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const baselineOverflow = await openProfessorSettings(page);

  const layout = await page.evaluate(() => {
    const deck = document.querySelector(".compact-panel-deck");
    const panels = [...deck.querySelectorAll(":scope > .compact-panel")];
    const deckRect = deck.getBoundingClientRect();
    const nextPanelRect = panels[1].getBoundingClientRect();
    const containedBody = panels[0].querySelector('.compact-panel-body[data-body-scroll="contained"]');
    const containedHeader = panels[0].querySelector(".compact-panel-header");
    const disclosureButtons = [...deck.querySelectorAll(".compact-disclosure-trigger")]
      .filter((button) => getComputedStyle(button).display !== "none");
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      deckWidth: deck.clientWidth,
      deckScrollWidth: deck.scrollWidth,
      deckOverflowX: getComputedStyle(deck).overflowX,
      snapType: getComputedStyle(deck).scrollSnapType,
      panelWidths: panels.map((panel) => panel.getBoundingClientRect().width),
      visiblePanels: panels.filter((panel) => panel.getClientRects().length).length,
      nextPanelPeek: Math.max(0, deckRect.right - nextPanelRect.left),
      containedBody: {
        clientHeight: containedBody.clientHeight,
        scrollHeight: containedBody.scrollHeight,
        overflowY: getComputedStyle(containedBody).overflowY,
        overscrollBlock: getComputedStyle(containedBody).overscrollBehaviorBlock,
      },
      containedHeaderDisplay: getComputedStyle(containedHeader).display,
      disclosureCount: disclosureButtons.length,
      disclosuresValid: disclosureButtons.every((button) => {
        const target = document.getElementById(button.getAttribute("aria-controls"));
        return button.hasAttribute("aria-expanded") && Boolean(target);
      }),
    };
  });

  const ratio = layout.panelWidths[0] / layout.deckWidth;
  assert.ok(layout.deckScrollWidth > layout.deckWidth, `${viewport.width}px deck must scroll horizontally.`);
  assert.equal(layout.deckOverflowX, "auto", `${viewport.width}px deck must use native overflow.`);
  assert.ok(layout.snapType.startsWith("x"), `${viewport.width}px deck must use optional horizontal snapping.`);
  assert.ok(ratio >= 0.84 && ratio <= 0.9, `${viewport.width}px panels must occupy 84–90% of the rail.`);
  assert.ok(layout.nextPanelPeek > 0, `${viewport.width}px must reveal part of the next panel.`);
  assert.equal(layout.visiblePanels, 4, `${viewport.width}px must keep every Settings panel reachable.`);
  assert.equal(layout.disclosureCount, 8, `${viewport.width}px must expose all disclosure buttons.`);
  assert.ok(layout.disclosuresValid, `${viewport.width}px disclosures need valid expanded/control relationships.`);
  assert.notEqual(layout.containedHeaderDisplay, "none", `${viewport.width}px contained header must remain visible.`);
  assert.equal(layout.containedBody.overflowY, "auto", `${viewport.width}px contained body must own vertical overflow.`);
  assert.equal(layout.containedBody.overscrollBlock, "auto", `${viewport.width}px contained body must allow scroll chaining.`);
  assert.ok(
    layout.documentOverflow <= baselineOverflow + 1,
    `${viewport.width}px deck must not add document-level horizontal overflow.`,
  );

  await page.getByRole("button", { name: "Assistant & plugins", exact: true }).click();
  await page.waitForTimeout(220);
  const alignedPanel = await page.evaluate(() => {
    const deck = document.querySelector(".compact-panel-deck");
    const railLeft = deck.getBoundingClientRect().left;
    return [...deck.querySelectorAll(":scope > .compact-panel")]
      .map((panel) => ({ id: panel.dataset.panelId, distance: Math.abs(panel.getBoundingClientRect().left - railLeft) }))
      .sort((a, b) => a.distance - b.distance)[0].id;
  });
  assert.equal(alignedPanel, "assistant", "The existing Settings buttons must provide a non-swipe route to each panel.");

  await page.getByRole("button", { name: "Workspace plugins", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Workspace plugins", exact: true }).getAttribute("aria-expanded"),
    "true",
    "Opening a mobile disclosure must update aria-expanded.",
  );
  assert.equal(
    await page.getByRole("button", { name: "Assistant model", exact: true }).getAttribute("aria-expanded"),
    "false",
    "The opted-in single-open group should close its previous major disclosure.",
  );

  if (viewport.width === 320) {
    assert.ok(
      layout.containedBody.scrollHeight > layout.containedBody.clientHeight,
      "The compact-height contained panel must have an independently scrollable body.",
    );
    const scrollResult = await page.evaluate(() => {
      const deck = document.querySelector(".compact-panel-deck");
      const panel = deck.querySelector('.compact-panel[data-panel-id="profile"]');
      const header = panel.querySelector(".compact-panel-header");
      const body = panel.querySelector('.compact-panel-body[data-body-scroll="contained"]');
      const before = { headerTop: header.getBoundingClientRect().top, railLeft: deck.scrollLeft };
      body.scrollTop = body.scrollHeight;
      const after = { headerTop: header.getBoundingClientRect().top, railLeft: deck.scrollLeft, bodyTop: body.scrollTop };
      return { before, after, maxBodyTop: body.scrollHeight - body.clientHeight };
    });
    assert.ok(scrollResult.after.bodyTop > 0, "Contained content must scroll vertically.");
    assert.ok(Math.abs(scrollResult.after.bodyTop - scrollResult.maxBodyTop) <= 1, "Contained content must reach its end.");
    assert.equal(scrollResult.after.headerTop, scrollResult.before.headerTop, "Contained scrolling must keep its header in place.");
    assert.equal(scrollResult.after.railLeft, scrollResult.before.railLeft, "Contained vertical scrolling must not move the rail sideways.");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const deck = page.locator(".compact-panel-deck");
    await deck.focus();
    await deck.press("End");
    const railAtEnd = await deck.evaluate((element) => element.scrollLeft);
    assert.ok(railAtEnd > 0, "End must navigate the focused rail horizontally.");
    const nestedKeyboard = await page.evaluate(() => {
      const targetDeck = document.querySelector(".compact-panel-deck");
      const nestedControl = [...targetDeck.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Copy my invitation link"));
      nestedControl.focus({ preventScroll: true });
      const before = targetDeck.scrollLeft;
      const event = new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true });
      nestedControl.dispatchEvent(event);
      return { before, after: targetDeck.scrollLeft, defaultPrevented: event.defaultPrevented };
    });
    assert.equal(nestedKeyboard.after, nestedKeyboard.before, "Arrow keys inside controls must not navigate the rail.");
    assert.equal(nestedKeyboard.defaultPrevented, false, "Nested control arrow keys must retain their native behavior.");

    const longLabelLayout = await page.evaluate(() => {
      const longLabel = "AssistanteneinstellungenundAutomatisierungsoptionen";
      const tab = document.querySelectorAll(".account-settings-tabs button")[1];
      const disclosureLabel = document.querySelector('.compact-panel[data-panel-id="assistant"] .compact-disclosure-trigger span');
      tab.textContent = longLabel;
      disclosureLabel.textContent = longLabel;
      return {
        tabsFit: tab.closest(".account-settings-tabs").scrollWidth <= tab.closest(".account-settings-tabs").clientWidth,
        disclosureFits: disclosureLabel.scrollWidth <= disclosureLabel.clientWidth,
      };
    });
    assert.ok(longLabelLayout.tabsFit, "Long translated Settings labels must wrap without widening the tab row.");
    assert.ok(longLabelLayout.disclosureFits, "Long translated disclosure labels must remain accessible without clipping.");

    await page.getByRole("button", { name: "Full", exact: true }).click();
    const fullMode = await page.evaluate(() => {
      const targetDeck = document.querySelector(".compact-panel-deck");
      return {
        display: getComputedStyle(targetDeck).display,
        visiblePanels: [...targetDeck.children].filter((panel) => panel.getClientRects().length).length,
      };
    });
    assert.equal(fullMode.display, "block", "Full view must bypass the compact horizontal rail.");
    assert.equal(fullMode.visiblePanels, 1, "Full view must retain the selected desktop Settings panel.");
    await page.getByRole("button", { name: "Auto", exact: true }).click();
  }

  if (viewport.width === 390) {
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await page.waitForTimeout(700);
    await page.locator(".account-settings-shell").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(resultsDirectory, "compact-panel-deck-mobile-390.png") });
  }

  await page.close();
  return { width: viewport.width, baselineOverflow, settingsOverflow: layout.documentOverflow };
}

await server.listen();
const address = server.httpServer.address();
assert.ok(address && typeof address !== "string", "The local Vite test server must expose a TCP port.");
const origin = `http://127.0.0.1:${address.port}`;

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await desktopCheck(context);
  const mobileResults = [];
  for (const viewport of [
    { width: 430, height: 860 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    mobileResults.push(await mobileCheck(context, viewport));
  }
  await context.close();
  console.log("CompactPanelDeck browser checks passed at desktop, 430px, 390px, and 320px.");
  console.log(`Visual snapshots: ${resolve(resultsDirectory, "compact-panel-deck-desktop.png")} and ${resolve(resultsDirectory, "compact-panel-deck-mobile-390.png")}`);
  console.log(`Existing-shell overflow comparison: ${JSON.stringify(mobileResults)}`);
} finally {
  await browser?.close();
  await server.close();
}
