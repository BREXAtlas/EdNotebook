import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import "./compact-panel-deck.css";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "");
}

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function CompactPanelDeck({
  children,
  ariaLabel,
  mobileMode = "horizontal",
  snap = "proximity",
  desktopActiveId,
  className = "",
}) {
  const railRef = useRef(null);
  const previousActiveId = useRef(desktopActiveId);
  const panels = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const childId = child.props.id;
    return cloneElement(child, {
      desktopActive: desktopActiveId == null || childId === desktopActiveId,
    });
  });

  useEffect(() => {
    if (desktopActiveId == null || previousActiveId.current === desktopActiveId) return;
    previousActiveId.current = desktopActiveId;
    const frame = window.requestAnimationFrame(() => {
      const rail = railRef.current;
      if (!rail || rail.scrollWidth <= rail.clientWidth + 1) return;
      const target = [...rail.querySelectorAll(":scope > [data-compact-panel]")]
        .find((panel) => panel.dataset.panelId === desktopActiveId);
      target?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
        inline: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [desktopActiveId]);

  function handleRailKeyDown(event) {
    if (
      event.defaultPrevented
      || event.target !== event.currentTarget
      || event.altKey
      || event.ctrlKey
      || event.metaKey
    ) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    const rail = railRef.current;
    if (!rail) return;
    const visiblePanels = [...rail.querySelectorAll(":scope > [data-compact-panel]")]
      .filter((panel) => panel.getClientRects().length > 0);
    if (!visiblePanels.length) return;

    const railRect = rail.getBoundingClientRect();
    const direction = window.getComputedStyle(rail).direction;
    const anchor = direction === "rtl" ? railRect.right : railRect.left;
    const currentIndex = visiblePanels.reduce((closestIndex, panel, index) => {
      const panelRect = panel.getBoundingClientRect();
      const panelAnchor = direction === "rtl" ? panelRect.right : panelRect.left;
      const closestRect = visiblePanels[closestIndex].getBoundingClientRect();
      const closestAnchor = direction === "rtl" ? closestRect.right : closestRect.left;
      return Math.abs(panelAnchor - anchor) < Math.abs(closestAnchor - anchor) ? index : closestIndex;
    }, 0);

    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = visiblePanels.length - 1;
    if (event.key === "ArrowRight") nextIndex += direction === "rtl" ? -1 : 1;
    if (event.key === "ArrowLeft") nextIndex += direction === "rtl" ? 1 : -1;
    nextIndex = Math.max(0, Math.min(visiblePanels.length - 1, nextIndex));

    event.preventDefault();
    visiblePanels[nextIndex].scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
      inline: "start",
    });
  }

  return (
    <div
      ref={railRef}
      className={classNames("compact-panel-deck", className)}
      data-mobile-mode={mobileMode}
      data-snap={snap}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleRailKeyDown}
    >
      {panels}
    </div>
  );
}

function CompactPanel({
  id,
  title,
  summary,
  bodyScroll = "document",
  desktopActive = true,
  children,
  className = "",
}) {
  const generatedId = useId();
  const panelId = `${safeId(generatedId)}-${safeId(id || "panel")}`;
  const titleId = `compact-panel-${panelId}-title`;

  return (
    <section
      className={classNames("compact-panel", className)}
      data-compact-panel
      data-panel-id={id || panelId}
      data-desktop-active={desktopActive ? "true" : "false"}
      data-body-scroll={bodyScroll}
      aria-labelledby={titleId}
    >
      <CompactPanelHeader id={titleId} title={title} summary={summary} />
      <CompactPanelBody mode={bodyScroll}>{children}</CompactPanelBody>
    </section>
  );
}

function CompactPanelHeader({ id, title, summary, children }) {
  return (
    <header className="compact-panel-header">
      <h2 id={id}>{title}</h2>
      {summary && <p>{summary}</p>}
      {children}
    </header>
  );
}

function CompactPanelBody({ mode = "document", children, className = "" }) {
  return (
    <div
      className={classNames("compact-panel-body", className)}
      data-body-scroll={mode}
    >
      {children}
    </div>
  );
}

function CompactDisclosureGroup({
  children,
  singleOpen = false,
  className = "",
  ariaLabel,
}) {
  const generatedId = safeId(useId());
  const items = Children.toArray(children);
  const itemIds = items.map((child, index) => {
    const localId = isValidElement(child) && child.props.id
      ? child.props.id
      : index + 1;
    return `compact-disclosure-${generatedId}-${safeId(localId)}`;
  });
  const defaultIds = items.flatMap((child, index) => (
    isValidElement(child) && child.props.defaultOpen ? [itemIds[index]] : []
  ));
  const [openIds, setOpenIds] = useState(() => new Set(
    singleOpen ? defaultIds.slice(0, 1) : defaultIds,
  ));

  function toggle(itemId, nextOpen) {
    setOpenIds((current) => {
      if (singleOpen) return nextOpen ? new Set([itemId]) : new Set();
      const next = new Set(current);
      if (nextOpen) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  return (
    <div
      className={classNames("compact-disclosure-group", className)}
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
    >
      {items.map((child, index) => {
        if (!isValidElement(child)) return child;
        const itemId = itemIds[index];
        return cloneElement(child, {
          disclosureId: itemId,
          open: openIds.has(itemId),
          onToggle: (nextOpen) => toggle(itemId, nextOpen),
        });
      })}
    </div>
  );
}

function CompactDisclosure({
  id,
  disclosureId,
  title,
  defaultOpen = false,
  open,
  onToggle,
  children,
  className = "",
  as: Element = "section",
}) {
  const generatedId = safeId(useId());
  const itemId = disclosureId || `compact-disclosure-${generatedId}-${safeId(id || "section")}`;
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const isOpen = open ?? localOpen;
  const triggerRef = useRef(null);
  const desktopTitleId = `${itemId}-desktop-title`;
  const triggerId = `${itemId}-trigger`;
  const contentId = `${itemId}-content`;

  function handleToggle() {
    const nextOpen = !isOpen;
    if (onToggle) onToggle(nextOpen);
    else setLocalOpen(nextOpen);

    if (!nextOpen) return;
    window.requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      const scrollBody = trigger?.closest('.compact-panel-body[data-body-scroll="contained"]');
      if (!trigger || !scrollBody) return;
      const triggerRect = trigger.getBoundingClientRect();
      const bodyRect = scrollBody.getBoundingClientRect();
      if (triggerRect.top >= bodyRect.top && triggerRect.bottom <= bodyRect.bottom) return;
      trigger.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });
  }

  return (
    <Element className={classNames("compact-disclosure", className)} data-open={isOpen ? "true" : "false"}>
      <h2 id={desktopTitleId} className="compact-disclosure-desktop-title">{title}</h2>
      <button
        ref={triggerRef}
        className="compact-disclosure-trigger"
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={handleToggle}
      >
        <span>{title}</span>
        <span className="compact-disclosure-indicator" aria-hidden="true">+</span>
      </button>
      <div
        className="compact-disclosure-content"
        id={contentId}
        role="region"
        aria-labelledby={desktopTitleId}
        data-open={isOpen ? "true" : "false"}
      >
        {children}
      </div>
    </Element>
  );
}

export {
  CompactPanelDeck,
  CompactPanel,
  CompactPanelHeader,
  CompactPanelBody,
  CompactDisclosureGroup,
  CompactDisclosure,
};
