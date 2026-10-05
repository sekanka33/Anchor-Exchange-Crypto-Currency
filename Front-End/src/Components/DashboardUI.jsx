import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

// Shared building blocks for the user Dashboard and the Admin Dashboard.

export const Card = ({ className = '', children }) => (
  <div className={`border rounded-2xl p-4 shadow-sm bg-white dark:bg-crypto-color border-gray-200 dark:border-line-color ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, subtitle, action }) => (
  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
    <div>
      <h2 className="font-bold text-sm text-slate-900 dark:text-white">{children}</h2>
      {subtitle && <p className="text-xs text-gray-500 dark:text-text-color mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// Loading / error / empty placeholder used inside every data panel.
export const PanelMessage = ({ kind = 'empty', children, onRetry }) => (
  <div
    role={kind === 'error' ? 'alert' : 'status'}
    className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-gray-500 dark:text-text-color"
  >
    {kind === 'loading' && (
      <span className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 animate-spin" aria-hidden="true" />
    )}
    {kind === 'error' && <AlertTriangle size={18} className="text-red-600 dark:text-red-400" aria-hidden="true" />}
    <span>{children}</span>
    {kind === 'error' && onRetry && (
      <button type="button" onClick={onRetry} className="text-blue-500 hover:underline font-semibold">
        Try again
      </button>
    )}
  </div>
);

// `trend` is a real percentage change (number) or null when there's no
// comparable previous period — never invented.
export const StatCard = ({ label, value, detail, loading, trend = null, trendLabel }) => (
  <Card className="p-4">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-color">{label}</p>
    {loading ? (
      <div className="mt-2 h-6 w-24 rounded bg-gray-200 dark:bg-input-field animate-pulse" aria-label="Loading" />
    ) : (
      <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
    )}
    {!loading && trend !== null && Number.isFinite(trend) && (
      <p className={`mt-1 text-xs font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {trend >= 0 ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
        {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        {trendLabel && <span className="font-normal text-gray-500 dark:text-text-color">{trendLabel}</span>}
      </p>
    )}
    {detail && !loading && <p className="mt-1 text-xs text-gray-500 dark:text-text-color">{detail}</p>}
  </Card>
);
