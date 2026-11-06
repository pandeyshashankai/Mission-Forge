export function InstrumentShelf({ panels, tab, onTab }) {
  const labels = {
    flight: "Flight",
    plan: "Plan",
    systems: "Systems",
    fleet: "Fleet",
  };
  return (
    <section className="instrument-shelf">
      <nav
        className="instrument-tabs"
        role="tablist"
        aria-label="Exploration instruments"
      >
        {Object.keys(panels).map((id) => (
          <button
            className="ui-button"
            key={id}
            role="tab"
            id={`instrument-tab-${id}`}
            data-testid={`instrument-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`instrument-panel-${id}`}
            onClick={() => onTab(id)}
          >
            {labels[id]}
          </button>
        ))}
      </nav>
      {Object.entries(panels).map(([id, panel]) => (
        <div
          key={id}
          role="tabpanel"
          hidden={tab !== id}
          id={`instrument-panel-${id}`}
          aria-labelledby={`instrument-tab-${id}`}
        >
          {panel}
        </div>
      ))}
    </section>
  );
}
