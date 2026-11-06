import { PARTS } from "../../sim/parts";

const colors = {
  tank: "#1a3d4b",
  engine: "#59402e",
  command: "#283f61",
  payload: "#514833",
  control: "#2a4752",
  recovery: "#554466",
  power: "#2e4d42",
  structure: "#273344",
};
export function Blueprint({ design, selectedUid, onSelect }) {
  const totalHeight = design.stack.reduce(
    (h, n) => h + PARTS[n.partId].height,
    0,
  );
  const scale = Math.min(8, 460 / Math.max(1, totalHeight));
  let y = 65;
  const nodes = design.stack.map((n) => {
    const p = PARTS[n.partId],
      h = Math.max(5, p.height * scale),
      top = y;
    y += h;
    return { n, p, h, y: top, w: Math.max(14, p.diameter * scale) };
  });
  return (
    <div
      className="absolute inset-0 overflow-auto bg-[#091521] scroll-thin"
      data-testid="blueprint-workspace"
    >
      <svg
        viewBox={`0 0 600 ${Math.max(620, y + 70)}`}
        className="h-full min-h-[520px] w-full"
        aria-label="Rocket assembly blueprint"
      >
        <defs>
          <pattern
            id="blueprint-grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M20 0H0V20"
              fill="none"
              stroke="#23455a"
              strokeWidth=".5"
            />
          </pattern>
        </defs>
        <rect width="600" height="100%" fill="url(#blueprint-grid)" />
        <path
          d={`M300 40V${y + 25}`}
          stroke="#4d8da5"
          strokeDasharray="5 6"
          opacity=".5"
        />
        <text x="25" y="35" fill="#598399" fontSize="9" letterSpacing="2">
          VEHICLE ASSEMBLY / ELEVATION
        </text>
        {nodes.map(({ n, p, h, y, w }, index) => (
          <g
            key={n.uid}
            role="button"
            tabIndex="0"
            aria-label={`Select ${p.name}`}
            data-testid={`blueprint-part-${n.uid}`}
            onClick={() => onSelect(n.uid)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(n.uid);
              }
            }}
            className="cursor-pointer"
          >
            <rect
              x={300 - w / 2}
              y={y}
              width={w}
              height={h}
              rx={p.category === "tank" ? 3 : 1}
              fill={
                selectedUid === n.uid
                  ? "#22647a"
                  : colors[p.category] || "#273344"
              }
              stroke={selectedUid === n.uid ? "#a5f3fc" : "#56839a"}
              strokeWidth={selectedUid === n.uid ? 1.8 : 0.7}
            />
            {p.engine && (
              <path
                d={`M${300 - w * 0.2} ${y + h * 0.4}L${300 - w * 0.5} ${y + h}H${300 + w * 0.5}L${300 + w * 0.2} ${y + h * 0.4}Z`}
                fill="#0c1723"
                stroke="#b89467"
                strokeWidth=".8"
              />
            )}
            <path
              d={`M${300 + w / 2 + 4} ${y + h / 2}H${index % 2 ? 210 : 385}`}
              stroke="#436377"
              strokeWidth=".6"
            />
            <text
              x={index % 2 ? 205 : 390}
              y={y + h / 2 + 3}
              textAnchor={index % 2 ? "end" : "start"}
              fill={selectedUid === n.uid ? "#a5f3fc" : "#8aabbc"}
              fontSize="7"
            >
              {p.name.length > 30 ? p.name.slice(0, 28) + "…" : p.name}
            </text>
            {(design.radials || [])
              .filter((r) => r.parentUid === n.uid)
              .map((r) => {
                const booster = PARTS[r.partId],
                  bh = booster.height * scale;
                return (
                  <g
                    key={r.uid}
                    data-testid={`blueprint-radial-${r.uid}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(r.uid);
                    }}
                  >
                    {[-1, 1].map((side) => (
                      <rect
                        key={side}
                        x={
                          300 +
                          side * (w / 2 + booster.diameter * scale) -
                          (booster.diameter * scale) / 2
                        }
                        y={y + h - bh}
                        width={booster.diameter * scale}
                        height={bh}
                        rx="3"
                        fill={selectedUid === r.uid ? "#22647a" : "#3c4147"}
                        stroke="#71919f"
                        strokeWidth=".8"
                      />
                    ))}
                  </g>
                );
              })}
          </g>
        ))}
        <path
          d={`M130 65H120V${y}H130M120 65H110M120 ${y}H110`}
          stroke="#5b879b"
          fill="none"
        />
        <text
          x="103"
          y={(y + 65) / 2}
          textAnchor="middle"
          fill="#a5cadb"
          fontSize="10"
          transform={`rotate(-90 103 ${(y + 65) / 2})`}
        >
          {totalHeight.toFixed(1)} m STACK HEIGHT
        </text>
        <text
          x="25"
          y={Math.max(590, y + 45)}
          fill="#598399"
          fontSize="9"
          letterSpacing="1"
        >
          SELECT A PART TO INSPECT · BLUEPRINT IS AN ASSEMBLY GUIDE
        </text>
      </svg>
    </div>
  );
}
