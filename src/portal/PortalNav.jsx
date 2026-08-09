const PORTALS = [
  ["student", "Student portal", "#/students"],
  ["professor", "Professor portal", "#/professors"],
  ["publishing", "Publishing portal", "#/publishers"],
  ["tour", "Take the tour", "#/tour"],
];

const EARLY_PREP_PORTALS = [
  ["student", "Early Prep student portal", "#/students/k12"],
  ["teacher", "High-school teacher portal", "#/early-prep/teacher"],
  ["tour", "Take the tour", "#/tour"],
];

export default function PortalNav({ active, action, actionLabel = "Sign in", track = "university" }) {
  const portals = track === "k12" ? EARLY_PREP_PORTALS : PORTALS;

  return (
    <header className="portal-nav">
      <a className="portal-brand" href="#/" aria-label="EdNotebook portal home">
        <img className="portal-nav-logo" src="/brand/ednotebook-logo-primary.svg" alt="EdNotebook — fun, connected learning" />
      </a>
      <nav aria-label="EdNotebook portals">
        {portals.map(([id, label, href]) => (
          <a className={active === id ? "is-active" : ""} href={href} key={id}>{label}</a>
        ))}
      </nav>
      {action && <button className="portal-nav-action" type="button" onClick={action}>{actionLabel}</button>}
    </header>
  );
}
