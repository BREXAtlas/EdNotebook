const PORTALS = [
  ["student", "Student portal", "#/students"],
  ["professor", "Professor portal", "#/professors"],
  ["publishing", "Publishing portal", "#/publishers"],
  ["tour", "Take the tour", "#/tour"],
];

export default function PortalNav({ active, action, actionLabel = "Sign in" }) {
  return (
    <header className="portal-nav">
      <a className="portal-brand" href="#/" aria-label="EdNotebook portal home">
        <img className="portal-nav-logo" src="/brand/ednotebook-logo-primary.svg" alt="EdNotebook — fun, connected learning" />
      </a>
      <nav aria-label="EdNotebook portals">
        {PORTALS.map(([id, label, href]) => (
          <a className={active === id ? "is-active" : ""} href={href} key={id}>{label}</a>
        ))}
      </nav>
      {action && <button className="portal-nav-action" type="button" onClick={action}>{actionLabel}</button>}
    </header>
  );
}
