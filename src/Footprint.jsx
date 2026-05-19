// The "footprint" diagram — a 4-level stacked floor-plan showing which floors
// are booked per stay. Same drawing, three states — teaches "one home, three
// footprints" at a glance.

const FOOTPRINT_FLOORS = {
  bamboo:  { 1: true },
  gateway: { 2: true, 3: true, 4: true },
  zen:     { 1: true, 2: true, 3: true, 4: true },
};

const FLOOR_LABELS = {
  4: "Rooftop",
  3: "3rd floor",
  2: "2nd floor",
  1: "1st floor",
};

export default function Footprint({ unit, size = "md", showLabels = false, showCaption = false }) {
  const active = FOOTPRINT_FLOORS[unit] || {};
  const dims = {
    sm: { w: 72,  h: 100, label: 9  },
    md: { w: 110, h: 150, label: 10 },
    lg: { w: 150, h: 200, label: 11 },
  }[size];

  const { w, h } = dims;
  const roofH = h * 0.10;
  const floorH = (h - roofH) / 4;
  const pad = 2;
  const floors = [4, 3, 2, 1];
  const unitColor = "var(--accent)";

  const caption =
    unit === "bamboo"  ? "1st floor suite" :
    unit === "gateway" ? "Floors 2 & 3 + rooftop" :
    unit === "zen"     ? "Entire townhouse" : "";

  return (
    <div className={`fp fp-${size}`}>
      <svg viewBox={`0 0 ${w + (showLabels ? 70 : 0)} ${h + 4}`} className="fp-svg" width="100%">
        <g transform="translate(0,2)">
          {floors.map((f, i) => {
            const y = roofH + i * floorH;
            const isActive = !!active[f];
            return (
              <g key={f}>
                <rect
                  x={pad}
                  y={y}
                  width={w - pad * 2}
                  height={floorH}
                  fill={isActive ? unitColor : "transparent"}
                  stroke={unitColor}
                  strokeWidth="1.2"
                  opacity={isActive ? 1 : 0.35}
                />
                <text
                  x={w / 2}
                  y={y + floorH / 2 + 3}
                  textAnchor="middle"
                  fontSize={floorH * 0.42}
                  fontFamily="serif"
                  fill={isActive ? "#fff" : "currentColor"}
                  opacity={isActive ? 1 : 0.5}
                  style={{ fontStyle: "italic" }}
                >
                  {f === 4 ? "R" : f}
                </text>
                {showLabels && (
                  <text
                    x={w + 8}
                    y={y + floorH / 2 + 3}
                    fontSize={dims.label}
                    fontFamily="inherit"
                    fill="currentColor"
                    opacity={isActive ? 0.95 : 0.45}
                  >
                    {FLOOR_LABELS[f]}
                  </text>
                )}
              </g>
            );
          })}
          <path
            d={`M ${pad - 2} ${roofH + 0.6} L ${w / 2} 1 L ${w - pad + 2} ${roofH + 0.6} Z`}
            fill="transparent"
            stroke={unitColor}
            strokeWidth="1.2"
            strokeLinejoin="miter"
          />
          {(unit === "zen" || unit === "bamboo") && (
            <rect
              x={w / 2 - w * 0.06}
              y={roofH + 3 * floorH + floorH - floorH * 0.38}
              width={w * 0.12}
              height={floorH * 0.38}
              fill="#fff"
              opacity="0.85"
            />
          )}
        </g>
      </svg>
      {showCaption && <div className="fp-caption">{caption}</div>}
    </div>
  );
}
