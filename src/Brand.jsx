export function BrandMark({ size = 44, inverse = false, title = "EdNotebook" }) {
  const ink = inverse ? "#FFFFFF" : "#101B33";
  const blue = inverse ? "#7AA2FF" : "#1D4ED8";
  const gold = "#F2B33D";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      <title>{title}</title>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={ink} />
      <path d="M15 17.5C15 14.5 17.5 12 20.5 12H31V48H20.5C17.5 48 15 50.5 15 53.5V17.5Z" fill="#FFFFFF" opacity="0.98" />
      <path d="M49 17.5C49 14.5 46.5 12 43.5 12H33V48H43.5C46.5 48 49 50.5 49 53.5V17.5Z" fill="#FFFFFF" opacity="0.98" />
      <path d="M19.5 22H28.5M19.5 28H28.5M19.5 34H26" stroke={blue} strokeWidth="3" strokeLinecap="round" />
      <path d="M38 23.5L41 26.5L47 19.5" fill="none" stroke={gold} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="42.5" cy="36.5" r="5.5" fill={gold} />
      <path d="M42.5 32.8V40.2M38.8 36.5H46.2" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M15 53.5C18.5 49.9 23 48 31 48M49 53.5C45.5 49.9 41 48 33 48" fill="none" stroke={blue} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function BrandLogo({
  inverse = false,
  compact = false,
  size = 42,
  tagline,
  style,
}) {
  const ink = inverse ? "#FFFFFF" : "#101B33";
  const muted = inverse ? "rgba(255,255,255,.72)" : "#5B6478";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
        ...style,
      }}
    >
      <BrandMark size={size} inverse={inverse} />
      {!compact && (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: ink,
              fontFamily: "'Zilla Slab', Georgia, serif",
              fontSize: Math.max(19, size * 0.5),
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: "-.025em",
              whiteSpace: "nowrap",
            }}
          >
            Ed<span style={{ color: "#F2B33D" }}>Notebook</span>
          </div>
          {tagline && (
            <div
              style={{
                color: muted,
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 10.5,
                lineHeight: 1.25,
                marginTop: 3,
                whiteSpace: "nowrap",
              }}
            >
              {tagline}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
