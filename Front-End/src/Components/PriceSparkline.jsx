import { useState } from "react";

const WIDTH = 120;
const HEIGHT = 36;
const PAD = 4;
const HOUR_MS = 60 * 60 * 1000;
const KEY_STEP = 6; // arrow keys move 6 hours at a time

const formatTime = (ms) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Seven-day price trend for one coin, from CoinGecko's `sparkline_in_7d`
// (hourly prices, oldest first, ending at `endTime`). Green when the week
// ended higher than it started, red when lower; the dotted line marks the
// starting price so the direction also reads without colour. Screen readers
// get the week's % change in the label.
// Hover (or focus + arrow keys) shows the price at that hour.
const PriceSparkline = ({ prices, name, changePercent, endTime, formatPrice }) => {
  const [active, setActive] = useState(null);

  const points = (prices || []).filter((p) => Number.isFinite(p));
  if (points.length < 2) {
    return <span className="text-xs text-gray-600 dark:text-gray-400">No 7-day data</span>;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const change = Number.isFinite(changePercent) ? changePercent : ((last - first) / first) * 100;
  const isUp = change >= 0;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const x = (i) => (i / (points.length - 1)) * WIDTH;
  const y = (v) => PAD + (1 - (v - min) / range) * (HEIGHT - PAD * 2);
  const line = points.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");

  // Points are hourly and end at `endTime`; without it, say how far back.
  const end = endTime ? new Date(endTime).getTime() : NaN;
  const timeLabel = (i) => {
    const hoursBack = points.length - 1 - i;
    if (Number.isFinite(end)) return formatTime(end - hoursBack * HOUR_MS);
    return hoursBack === 0 ? "Latest" : `${hoursBack} h before latest`;
  };

  const colorClass = isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  const summary = `${name}: ${isUp ? "up" : "down"} ${Math.abs(change).toFixed(2)}% over the last 7 days, from ${formatPrice(first)} to ${formatPrice(last)}`;

  const indexFromPointer = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    return Math.round(ratio * (points.length - 1));
  };

  const handleKeyDown = (e) => {
    const lastIndex = points.length - 1;
    const current = active ?? lastIndex;
    const next = {
      ArrowLeft: Math.max(0, current - KEY_STEP),
      ArrowRight: Math.min(lastIndex, current + KEY_STEP),
      Home: 0,
      End: lastIndex,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`relative ${colorClass} rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500`}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onPointerMove={(e) => setActive(indexFromPointer(e))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={handleKeyDown}
      >
        <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block overflow-visible" aria-hidden="true">
          {/* starting price, for reading the week's net change */}
          <line
            x1="0" x2={WIDTH} y1={y(first)} y2={y(first)}
            className="text-gray-300 dark:text-gray-600" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3"
          />
          <polyline
            points={line}
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
          {active === null ? (
            <circle cx={x(points.length - 1)} cy={y(last)} r="2.5" fill="currentColor" />
          ) : (
            <>
              <line
                x1={x(active)} x2={x(active)} y1="0" y2={HEIGHT}
                className="text-gray-400 dark:text-gray-500" stroke="currentColor" strokeWidth="1"
              />
              <circle
                cx={x(active)} cy={y(points[active])} r="3.5" fill="currentColor"
                className="stroke-white dark:stroke-zinc-950" strokeWidth="1.5"
              />
            </>
          )}
        </svg>

        {active !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-200 dark:border-line-color bg-white dark:bg-crypto-color px-2.5 py-1.5 text-left shadow-md"
            style={{ left: `${(x(active) / WIDTH) * 100}%` }}
          >
            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatPrice(points[active])}</p>
            <p className="text-[11px] text-gray-600 dark:text-gray-400">{timeLabel(active)}</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default PriceSparkline;
