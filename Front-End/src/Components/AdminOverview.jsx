import { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useCurrency } from '../hooks/useCurrency';
import { useApi } from '../hooks/useApi';
import { authFetch } from '../api/authFetch';
import { Card, CardTitle, PanelMessage, StatCard } from './DashboardUI';
import BarChart from './BarChart';

const RANGES = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '3 Months' },
  { value: '180d', label: '6 Months' },
  { value: '1y', label: '1 Year' },
];

// Status palette (dataviz reference): reserved for state, always shown with a label.
const STATUS_META = {
  COMPLETED: { label: 'Completed', color: 'bg-[#0ca30c]' },
  OPEN: { label: 'Open', color: 'bg-[#fab219]' },
  PENDING: { label: 'Pending', color: 'bg-[#fab219]' },
  PENDING_CONFIRMATION: { label: 'Pending confirmation', color: 'bg-[#fab219]' },
  FAILED: { label: 'Failed', color: 'bg-[#d03b3b]' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-500' },
  EXPIRED: { label: 'Expired', color: 'bg-gray-300 dark:bg-gray-600' },
};

const FAILED_LOOKBACK_DAYS = 7;

const formatCount = (value) => Number(value || 0).toLocaleString('en-US');
const formatAmount = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 8 });

// Percentage change vs the previous period, or null when there's nothing to compare against.
const pctChange = (current, previous) => (previous > 0 ? ((current - previous) / previous) * 100 : null);

const bucketLabel = (isoDate, unit) => {
  const d = new Date(`${isoDate}T00:00:00`);
  if (unit === 'month') return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return unit === 'week' ? `Wk of ${day}` : day;
};

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const RangeTabs = ({ value, onChange, label }) => (
  <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
    {RANGES.map((r) => (
      <button
        key={r.value}
        type="button"
        onClick={() => onChange(r.value)}
        aria-pressed={value === r.value}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
          value === r.value ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-input-field'
        }`}
      >
        {r.label}
      </button>
    ))}
  </div>
);

// One horizontal stacked bar per operation type (part-to-whole), with labelled counts.
const StatusBreakdown = ({ rows }) => (
  <div className="space-y-5">
    {rows.map(({ label, counts }) => {
      const entries = Object.entries(counts).filter(([, n]) => n > 0);
      const total = entries.reduce((sum, [, n]) => sum + n, 0);
      return (
        <div key={label}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
            <span className="text-gray-500 dark:text-text-color">{formatCount(total)} total</span>
          </div>
          {total === 0 ? (
            <p className="text-xs text-gray-500 dark:text-text-color">No data available yet.</p>
          ) : (
            <>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full gap-[2px]" role="img" aria-label={`${label} by status`}>
                {entries.map(([status, n]) => (
                  <div
                    key={status}
                    className={`${STATUS_META[status]?.color || 'bg-gray-400'} first:rounded-l-full last:rounded-r-full`}
                    style={{ width: `${(n / total) * 100}%` }}
                    title={`${STATUS_META[status]?.label || status}: ${formatCount(n)}`}
                  />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600 dark:text-text-color">
                {Object.entries(counts).map(([status, n]) => (
                  <li key={status} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_META[status]?.color || 'bg-gray-400'}`} aria-hidden="true" />
                    {STATUS_META[status]?.label || status}: <span className="font-semibold text-slate-900 dark:text-white">{formatCount(n)}</span>
                    {n > 0 && <span>({((n / total) * 100).toFixed(0)}%)</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      );
    })}
  </div>
);

const AttentionItem = ({ icon: Icon, tone, title, record, amount, onView }) => (
  <li className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-input-field">
    <div className="flex items-start gap-3 min-w-0">
      <span className={`mt-0.5 p-1.5 rounded-lg ${tone === 'critical' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 text-xs">
        <p className="font-semibold text-sm text-slate-900 dark:text-white">{title}</p>
        <p className="text-gray-600 dark:text-gray-400 truncate">User: {record.user_email}</p>
        <p className="text-gray-600 dark:text-gray-400">
          Amount: <span className="font-semibold text-slate-900 dark:text-white">{amount}</span>
          {record.type && <> · {record.type === 'FIAT' ? 'Fiat' : 'Crypto'}</>}
        </p>
        <p className="text-gray-500 dark:text-text-color">{formatDate(record.created_at)}</p>
      </div>
    </div>
    <button type="button" onClick={onView} className="text-xs font-semibold text-blue-500 hover:underline flex items-center">
      View <ArrowUpRight size={12} className="ml-0.5" aria-hidden="true" />
    </button>
  </li>
);

const TX_TYPE_STYLES = {
  BUY: 'text-green-700 dark:text-green-400',
  SELL: 'text-red-600 dark:text-red-400',
  DEPOSIT: 'text-blue-600 dark:text-blue-400',
  WITHDRAWAL: 'text-amber-700 dark:text-amber-400',
};

/**
 * Admin "Overview" tab. Every number comes from the backend:
 *  - stats:  GET /api/admin/stats (already loaded by the page's access check)
 *  - charts: GET /api/admin/stats/history?range=… (cached per range)
 *  - attention / recent: the existing admin list endpoints, filtered by status
 */
const AdminOverview = ({ stats, statsError, onReloadStats, onOpenTab, onViewUser }) => {
  const { formatMoney } = useCurrency();
  const [range, setRange] = useState('30d');
  const [growthRange, setGrowthRange] = useState('90d');
  const [txPage, setTxPage] = useState(1);

  // One request per range, shared by every chart that uses it.
  const historyCache = useRef({});
  const loadHistory = (r) => {
    if (!historyCache.current[r]) {
      historyCache.current[r] = authFetch(`/api/admin/stats/history?range=${r}`).catch((err) => {
        delete historyCache.current[r];
        throw err;
      });
    }
    return historyCache.current[r];
  };

  const history = useApi(() => loadHistory(range), [range]);
  const growth = useApi(() => loadHistory(growthRange), [growthRange]);

  const attention = useApi(async () => {
    const [pendingDeposits, pendingWithdrawals, failedDeposits] = await Promise.all([
      authFetch('/api/admin/deposits?status=PENDING&limit=5'),
      authFetch('/api/admin/withdrawals?status=PENDING_CONFIRMATION&limit=5'),
      authFetch('/api/admin/deposits?status=FAILED&limit=5'),
    ]);
    const cutoff = Date.now() - FAILED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    return {
      pendingDeposits,
      pendingWithdrawals,
      failedDeposits: failedDeposits.deposits.filter((d) => new Date(d.created_at).getTime() >= cutoff),
    };
  }, []);

  const recent = useApi(() => authFetch(`/api/admin/transactions?limit=8&page=${txPage}`), [txPage]);

  const refreshAll = () => {
    historyCache.current = {};
    onReloadStats();
    history.reload();
    growth.reload();
    attention.reload();
    recent.reload();
  };

  const money = (v) => formatMoney(v);
  const moneyAxis = (v) => formatMoney(v, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const assetAmount = (amount, asset) => (asset === 'USD' ? formatMoney(amount) : `${formatAmount(amount)} ${asset}`);

  const toChartData = (res, pick) =>
    (res?.series || []).map((b) => ({ key: b.start, label: bucketLabel(b.start, res.unit), values: pick(b) }));

  const rangeLabel = RANGES.find((r) => r.value === range)?.label.toLowerCase();
  const sum = (key) => (history.data?.series || []).reduce((s, b) => s + b[key], 0);

  const renderChart = (state, render) => {
    if (state.loading) return <PanelMessage kind="loading">Loading…</PanelMessage>;
    if (state.error && !state.data) return <PanelMessage kind="error" onRetry={state.reload}>Unable to load this data.</PanelMessage>;
    return render(state.data);
  };

  /* ---------------- Summary cards ---------------- */

  const s = stats;
  const statsLoading = !s && !statsError;

  const attentionCount = attention.data
    ? attention.data.pendingDeposits.pagination.total +
      attention.data.pendingWithdrawals.pagination.total +
      attention.data.failedDeposits.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Live platform activity from the Anchor Exchange database.</p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition bg-white dark:bg-crypto-color border-gray-200 dark:border-line-color hover:border-blue-500"
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {statsError && !s && (
        <Card>
          <PanelMessage kind="error" onRetry={onReloadStats}>Unable to load this data.</PanelMessage>
        </Card>
      )}

      {/* SUMMARY CARDS */}
      {!statsError || s ? (
        <section aria-label="Platform summary" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total users"
            loading={statsLoading}
            value={s && formatCount(s.users.total)}
            trend={s && pctChange(s.users.newLast30Days, s.users.newPrevious30Days)}
            trendLabel="new users vs prior 30d"
            detail={s && `${formatCount(s.users.verified)} verified · ${formatCount(s.users.newLast30Days)} joined in 30d`}
          />
          <StatCard
            label="Active users (30d)"
            loading={statsLoading}
            value={s && formatCount(s.users.activeLast30Days)}
            detail={s && `Placed an order, deposit or withdrawal${s.users.total ? ` · ${((s.users.activeLast30Days / s.users.total) * 100).toFixed(0)}% of users` : ''}`}
          />
          <StatCard
            label="Total trading volume"
            loading={statsLoading}
            value={s && formatMoney(s.orders.volumeUsd)}
            trend={s && pctChange(s.orders.volumeLast30DaysUsd, s.orders.volumePrevious30DaysUsd)}
            trendLabel="30d vs prior 30d"
            detail={s && `${formatMoney(s.orders.volumeLast30DaysUsd)} in the last 30 days`}
          />
          <StatCard
            label="Total transactions"
            loading={statsLoading}
            value={s && formatCount(s.transactions.total)}
            detail="Completed buys, sells, deposits & withdrawals"
          />
          <StatCard
            label="Pending deposits"
            loading={statsLoading}
            value={s && formatCount(s.deposits.pending)}
            detail="Awaiting payment confirmation"
          />
          <StatCard
            label="Pending withdrawals"
            loading={statsLoading}
            value={s && formatCount(s.withdrawals.pendingConfirmation)}
            detail="Awaiting user email confirmation"
          />
          <StatCard
            label="Total orders"
            loading={statsLoading}
            value={s && formatCount(s.orders.total)}
            trend={s && pctChange(s.orders.countLast30Days, s.orders.countPrevious30Days)}
            trendLabel="30d vs prior 30d"
            detail={s && `${formatCount(s.orders.buy)} buy · ${formatCount(s.orders.sell)} sell`}
          />
          <StatCard
            label="Failed deposits"
            loading={statsLoading}
            value={s && formatCount(s.deposits.statusCounts.FAILED)}
            detail="Payments declined by the provider"
          />
        </section>
      ) : null}

      {/* REQUIRES ATTENTION */}
      <Card className="border-amber-500/40 dark:border-amber-500/30">
        <CardTitle
          subtitle={attention.data && attentionCount > 0 ? `${formatCount(attentionCount)} item${attentionCount === 1 ? '' : 's'} need review` : undefined}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" aria-hidden="true" /> Requires Attention
          </span>
        </CardTitle>
        {attention.loading ? (
          <PanelMessage kind="loading">Checking for pending and failed operations…</PanelMessage>
        ) : attention.error && !attention.data ? (
          <PanelMessage kind="error" onRetry={attention.reload}>Unable to load this data.</PanelMessage>
        ) : attentionCount === 0 ? (
          <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-green-700 dark:text-green-400">
            <CheckCircle size={16} aria-hidden="true" /> Everything is up to date.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              {
                key: 'withdrawals',
                heading: 'Pending withdrawals',
                total: attention.data.pendingWithdrawals.pagination.total,
                items: attention.data.pendingWithdrawals.withdrawals,
                icon: ArrowUpFromLine,
                tone: 'warning',
                title: 'Pending withdrawal',
                open: () => onOpenTab('Withdrawals', 'PENDING_CONFIRMATION'),
              },
              {
                key: 'deposits',
                heading: 'Pending deposits',
                total: attention.data.pendingDeposits.pagination.total,
                items: attention.data.pendingDeposits.deposits,
                icon: ArrowDownToLine,
                tone: 'warning',
                title: 'Pending deposit',
                open: () => onOpenTab('Deposits', 'PENDING'),
              },
              {
                key: 'failed',
                heading: `Failed deposits (last ${FAILED_LOOKBACK_DAYS} days)`,
                total: attention.data.failedDeposits.length,
                items: attention.data.failedDeposits,
                icon: XCircle,
                tone: 'critical',
                title: 'Failed deposit',
                open: () => onOpenTab('Deposits', 'FAILED'),
              },
            ].map((group) => (
              <div key={group.key}>
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">{group.heading}</span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-input-field font-semibold">{formatCount(group.total)}</span>
                </div>
                {group.items.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-text-color py-3">None.</p>
                ) : (
                  <ul className="space-y-2">
                    {group.items.map((r) => (
                      <AttentionItem
                        key={r.id}
                        icon={group.icon}
                        tone={group.tone}
                        title={group.title}
                        record={r}
                        amount={assetAmount(r.amount, r.asset)}
                        onView={group.open}
                      />
                    ))}
                  </ul>
                )}
                {group.total > group.items.length && (
                  <button type="button" onClick={group.open} className="mt-2 text-xs text-blue-500 hover:underline">
                    View all {formatCount(group.total)} →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* PERIOD FILTER */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-color">Period</span>
        <RangeTabs value={range} onChange={setRange} label="Chart period" />
        <span className="text-xs text-gray-500 dark:text-text-color">Applies to trading, money-flow and asset charts</span>
      </div>

      {/* TRADING VOLUME + TOP ASSETS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardTitle
            subtitle={
              history.data && sum('volumeUsd') > 0
                ? `${formatMoney(sum('volumeUsd'))} across ${formatCount(sum('orders'))} completed orders in the last ${rangeLabel}`
                : 'Completed buy and sell orders'
            }
          >
            Trading Volume History
          </CardTitle>
          {renderChart(history, (data) => (
            <BarChart
              height="h-64"
              data={toChartData(data, (b) => ({ volume: b.volumeUsd }))}
              series={[{ key: 'volume', label: 'Trading volume' }]}
              formatValue={money}
              formatAxis={moneyAxis}
              caption="Trading volume per period"
              emptyMessage={`Historical trading data is unavailable — no orders were completed in the last ${rangeLabel}.`}
            />
          ))}
        </Card>

        <Card>
          <CardTitle subtitle={`By completed-order volume, last ${rangeLabel}`}>Most Traded Assets</CardTitle>
          {renderChart(history, (data) => {
            const assets = data?.topAssets || [];
            const total = assets.reduce((t, a) => t + a.volumeUsd, 0);
            if (assets.length === 0) return <PanelMessage>No data available yet.</PanelMessage>;
            return (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-text-color border-b border-gray-200 dark:border-line-color">
                    <th className="pb-2 font-semibold">Asset</th>
                    <th className="pb-2 font-semibold text-right">Volume</th>
                    <th className="pb-2 font-semibold text-right">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-line-color">
                  {assets.map((a) => (
                    <tr key={a.asset}>
                      <td className="py-2.5">
                        <p className="font-bold">{a.asset}</p>
                        <div className="mt-1 h-1.5 w-24 rounded-full bg-gray-100 dark:bg-input-field overflow-hidden" aria-hidden="true">
                          <div className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${total ? (a.volumeUsd / total) * 100 : 0}%` }} />
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatMoney(a.volumeUsd)}
                        <p className="text-[10px] text-gray-500 dark:text-text-color">{total ? ((a.volumeUsd / total) * 100).toFixed(1) : 0}%</p>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{formatCount(a.trades)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })}
        </Card>
      </div>

      {/* MONEY FLOW + BUY/SELL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle
            subtitle={
              history.data
                ? `In ${formatMoney(sum('depositsUsd'))} · Out ${formatMoney(sum('withdrawalsUsd'))} · Net ${formatMoney(sum('depositsUsd') - sum('withdrawalsUsd'))} (completed fiat, USD)`
                : 'Completed fiat deposits and withdrawals'
            }
          >
            Deposits vs Withdrawals
          </CardTitle>
          {renderChart(history, (data) => (
            <BarChart
              data={toChartData(data, (b) => ({ deposits: b.depositsUsd, withdrawals: b.withdrawalsUsd }))}
              series={[{ key: 'deposits', label: 'Deposits' }, { key: 'withdrawals', label: 'Withdrawals' }]}
              formatValue={money}
              formatAxis={moneyAxis}
              caption="Fiat deposits and withdrawals per period"
              emptyMessage={`No completed fiat deposits or withdrawals in the last ${rangeLabel}.`}
            />
          ))}
          <p className="mt-3 text-[11px] text-gray-500 dark:text-text-color">
            Crypto transfers aren't valued here — the backend doesn't record their USD value at the time of transfer.
          </p>
        </Card>

        <Card>
          <CardTitle
            subtitle={
              history.data
                ? `Buy ${formatMoney(sum('buyVolumeUsd'))} · Sell ${formatMoney(sum('sellVolumeUsd'))}`
                : 'Completed order volume by side'
            }
          >
            Buy vs Sell Activity
          </CardTitle>
          {renderChart(history, (data) => (
            <BarChart
              data={toChartData(data, (b) => ({ buy: b.buyVolumeUsd, sell: b.sellVolumeUsd }))}
              series={[{ key: 'buy', label: 'Buy volume' }, { key: 'sell', label: 'Sell volume' }]}
              formatValue={money}
              formatAxis={moneyAxis}
              caption="Buy and sell volume per period"
              emptyMessage={`No completed orders in the last ${rangeLabel}.`}
            />
          ))}
        </Card>
      </div>

      {/* USER GROWTH + ORDERS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardTitle
            subtitle={
              growth.data
                ? `${formatCount(growth.data.series.reduce((t, b) => t + b.newUsers, 0))} new registrations · ${
                    growth.data.unit === 'day' ? 'daily' : growth.data.unit === 'week' ? 'weekly' : 'monthly'
                  }`
                : 'New user registrations'
            }
            action={<RangeTabs value={growthRange} onChange={setGrowthRange} label="User growth period" />}
          >
            User Growth
          </CardTitle>
          {renderChart(growth, (data) => (
            <BarChart
              data={toChartData(data, (b) => ({ users: b.newUsers }))}
              series={[{ key: 'users', label: 'New users' }]}
              formatValue={(v) => `${formatCount(v)} user${v === 1 ? '' : 's'}`}
              formatAxis={(v) => (Number.isInteger(v) ? formatCount(v) : '')}
              caption="New user registrations per period"
              emptyMessage="No user registrations in this period."
            />
          ))}
        </Card>

        <Card>
          <CardTitle
            action={
              <button type="button" onClick={() => onOpenTab('Orders')} className="text-xs text-blue-500 hover:underline flex items-center">
                All orders <ArrowUpRight size={12} className="ml-0.5" aria-hidden="true" />
              </button>
            }
          >
            Orders Overview
          </CardTitle>
          {statsLoading ? (
            <PanelMessage kind="loading">Loading…</PanelMessage>
          ) : !s ? (
            <PanelMessage kind="error" onRetry={onReloadStats}>Unable to load this data.</PanelMessage>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Total orders', s.orders.total, null],
                ['Completed', s.orders.statusCounts.COMPLETED, CheckCircle],
                ['Open', s.orders.statusCounts.OPEN, Clock],
                ['Cancelled', s.orders.statusCounts.CANCELLED, XCircle],
                ['Buy orders', s.orders.buy, null],
                ['Sell orders', s.orders.sell, null],
              ].map(([label, value, Icon]) => (
                <div key={label} className="p-3 rounded-xl bg-gray-50 dark:bg-input-field">
                  <dt className="text-[11px] text-gray-500 dark:text-text-color flex items-center gap-1">
                    {Icon && <Icon size={12} aria-hidden="true" />} {label}
                  </dt>
                  <dd className="text-lg font-bold tabular-nums">{formatCount(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      {/* STATUS + RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <CardTitle subtitle="All-time, by current status">Transaction Status</CardTitle>
          {statsLoading ? (
            <PanelMessage kind="loading">Loading…</PanelMessage>
          ) : !s ? (
            <PanelMessage kind="error" onRetry={onReloadStats}>Unable to load this data.</PanelMessage>
          ) : (
            <StatusBreakdown
              rows={[
                { label: 'Deposits', counts: s.deposits.statusCounts },
                { label: 'Withdrawals', counts: s.withdrawals.statusCounts },
                { label: 'Orders', counts: s.orders.statusCounts },
              ]}
            />
          )}
        </Card>

        <Card className="xl:col-span-2 p-0 overflow-hidden">
          <div className="p-4 pb-0">
            <CardTitle
              action={
                <button type="button" onClick={() => onOpenTab('Transactions')} className="text-xs text-blue-500 hover:underline flex items-center">
                  View all transactions <ArrowUpRight size={12} className="ml-0.5" aria-hidden="true" />
                </button>
              }
            >
              Recent Transactions
            </CardTitle>
          </div>
          {recent.loading ? (
            <PanelMessage kind="loading">Loading transactions…</PanelMessage>
          ) : recent.error && !recent.data ? (
            <PanelMessage kind="error" onRetry={recent.reload}>Unable to load this data.</PanelMessage>
          ) : !recent.data?.transactions.length ? (
            <PanelMessage>No data available yet.</PanelMessage>
          ) : (
            <>
              <div className="relative overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-text-color border-b border-gray-200 dark:border-line-color">
                      <th className="px-4 py-2.5 font-semibold">Date/Time</th>
                      <th className="px-4 py-2.5 font-semibold">User</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Value</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-line-color">
                    {recent.data.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-input-field">
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-400">{formatDate(t.created_at)}</td>
                        <td className="px-4 py-2.5 max-w-44 truncate">{t.user_email}</td>
                        <td className={`px-4 py-2.5 font-semibold ${TX_TYPE_STYLES[t.type] || ''}`}>{t.type.charAt(0) + t.type.slice(1).toLowerCase()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{formatAmount(t.amount)} {t.asset}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {/* Buy/sell totals are USD; deposit/withdrawal totals are in the asset itself. */}
                          {t.type === 'BUY' || t.type === 'SELL' ? formatMoney(t.total) : assetAmount(t.total, t.asset)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 ${t.status === 'COMPLETED' ? 'text-green-700 dark:text-green-400' : t.status === 'FAILED' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                            {t.status === 'COMPLETED' && <CheckCircle size={12} aria-hidden="true" />}
                            {STATUS_META[t.status]?.label || t.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onViewUser({ id: t.user_id, email: t.user_email })}
                            className="text-blue-500 hover:underline whitespace-nowrap"
                          >
                            View user
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recent.data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-line-color text-xs text-gray-600 dark:text-gray-400">
                  <span>
                    Page {recent.data.pagination.page} of {recent.data.pagination.totalPages} · {formatCount(recent.data.pagination.total)} transactions
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={txPage <= 1}
                      onClick={() => setTxPage((p) => p - 1)}
                      aria-label="Previous page"
                      className="p-1.5 rounded-lg border border-gray-300 dark:border-line-color disabled:opacity-40 hover:border-blue-500"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={txPage >= recent.data.pagination.totalPages}
                      onClick={() => setTxPage((p) => p + 1)}
                      aria-label="Next page"
                      className="p-1.5 rounded-lg border border-gray-300 dark:border-line-color disabled:opacity-40 hover:border-blue-500"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
