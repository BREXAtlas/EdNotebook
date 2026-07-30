import { useEffect, useRef, useState } from "react";

function formatNotificationDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function CourseNotificationCenter({
  notifications = [],
  onSelect,
  onOpenCalendar,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const count = notifications.length;

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="course-notification-center" ref={containerRef}>
      <button
        className="course-notification-trigger"
        type="button"
        aria-label={`Notifications${count ? `, ${count} active` : ""}`}
        aria-controls="course-notification-popover"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        {count
          ? (
            <span className="course-notification-badge" aria-hidden="true">
              {count > 9 ? "9+" : count}
            </span>
          )
          : null}
      </button>
      {open
        ? (
          <section
            className="course-notification-popover"
            id="course-notification-popover"
            role="dialog"
            aria-label="Recent course notifications"
          >
            <header>
              <strong>Notifications</strong>
              <span>{count} active</span>
            </header>
            <div className="course-notification-list">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => {
                    setOpen(false);
                    onSelect?.(notification);
                  }}
                >
                  <span>{notification.label}</span>
                  <strong>{notification.title}</strong>
                  <small>{notification.body}</small>
                  <time dateTime={notification.dueAt}>
                    Due {formatNotificationDate(notification.dueAt)}
                  </time>
                </button>
              ))}
              {!notifications.length
                ? (
                  <p>
                    You are caught up. New calendar reminders will appear here.
                  </p>
                )
                : null}
            </div>
            <button
              className="course-notification-calendar-link"
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenCalendar?.();
              }}
            >
              Open calendar and reminder settings
            </button>
          </section>
        )
        : null}
    </div>
  );
}
