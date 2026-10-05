import { useState } from 'react';

// Categorical slots from the dataviz reference palette (light / dark steps),
// validated for colour-blind separation in this order.
const SERIES_COLORS = [
  'bg-[#2a78d6] dark:bg-[#3987e5]',
  'bg-[#eb6834] dark:bg-[#d95926]',
];

/**
 * Responsive bar chart: one bar per point, grouped side by side when there
 * is more than one series. One y-axis only, so every series must share a unit.
 *
 * data:   [{ key, label, values: { [seriesKey]: number } }]
 * series: [{ key, label }]   (max 2 — colours are fixed per slot)
 */
const BarChart = ({ data, series, formatValue, formatAxis = formatValue, height = 'h-48', emptyMessage = 'No data available yet.', caption }) => {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] || 0)));

  if (data.length === 0 || max === 0) {
    return (
      <div role="status" className="flex items-center justify-center py-10 text-center text-xs text-gray-500 dark:text-text-color">
        {emptyMessage}
      </div>
    );
  }

  const gridLines = [1, 0.5, 0];
  const mid = Math.floor(data.length / 2);

  return (
    <div>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-600 dark:text-text-color">
          {series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${SERIES_COLORS[i]}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        {/* Y axis */}
        <div className={`relative w-14 ${height} shrink-0 text-[10px] text-gray-500 dark:text-text-color`} aria-hidden="true">
          {gridLines.map((g) => (
            <span key={g} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${(1 - g) * 100}%` }}>
              {formatAxis(max * g)}
            </span>
          ))}
        </div>

        <div className="relative flex-1 min-w-0">
          {/* Recessive grid */}
          <div className={`absolute inset-x-0 top-0 ${height} pointer-events-none`} aria-hidden="true">
            {gridLines.map((g) => (
              <div
                key={g}
                className="absolute left-0 right-0 border-t border-dashed border-gray-200 dark:border-line-color"
                style={{ top: `${(1 - g) * 100}%` }}
              />
            ))}
          </div>

          {/* Bars: 2px gaps, rounded data-end, full-height hit targets */}
          <div className={`relative ${height} flex items-end gap-[2px]`} aria-hidden="true">
            {data.map((d, i) => (
              <div
                key={d.key}
                className="relative flex-1 h-full flex items-end gap-[2px]"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {series.map((s, si) => {
                  const v = d.values[s.key] || 0;
                  return (
                    <div
                      key={s.key}
                      className={`flex-1 rounded-t-[4px] transition-opacity ${SERIES_COLORS[si]} ${hovered !== null && hovered !== i ? 'opacity-50' : ''}`}
                      style={{ height: v > 0 ? `max(2px, ${(v / max) * 100}%)` : 0 }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {hovered !== null && (
            <div
              className={`absolute z-10 top-0 -translate-y-full pointer-events-none whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs shadow-lg bg-white dark:bg-hero-dark border-gray-200 dark:border-line-color ${
                hovered < data.length / 4 ? '' : hovered > (data.length * 3) / 4 ? '-translate-x-full' : '-translate-x-1/2'
              }`}
              style={{ left: `${((hovered + 0.5) / data.length) * 100}%` }}
            >
              <p className="text-gray-500 dark:text-text-color mb-0.5">{data[hovered].label}</p>
              {series.map((s, si) => (
                <p key={s.key} className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                  {series.length > 1 && <span className={`w-2 h-2 rounded-sm ${SERIES_COLORS[si]}`} aria-hidden="true" />}
                  {series.length > 1 && <span className="font-normal text-gray-500 dark:text-text-color">{s.label}</span>}
                  {formatValue(data[hovered].values[s.key] || 0)}
                </p>
              ))}
            </div>
          )}

          {/* X axis: first, middle and last bucket */}
          <div className="flex justify-between mt-2 text-[10px] text-gray-500 dark:text-text-color" aria-hidden="true">
            <span>{data[0].label}</span>
            {data.length > 2 && <span>{data[mid].label}</span>}
            <span>{data[data.length - 1].label}</span>
          </div>
        </div>
      </div>

      {/* Table view for screen readers */}
      <table className="sr-only">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th>Period</th>
            {series.map((s) => <th key={s.key}>{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <td>{d.label}</td>
              {series.map((s) => <td key={s.key}>{formatValue(d.values[s.key] || 0)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BarChart;
