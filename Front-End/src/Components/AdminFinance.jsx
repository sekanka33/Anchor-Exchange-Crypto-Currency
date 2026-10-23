import { useState } from "react";
import Modal from "./Modal";
import { StatusBadge } from "./FinanceUI";
import { useApi } from "../hooks/useApi";
import { authFetch } from "../api/authFetch";
import { formatAmount, STATUS_META } from "../utils/finance";

const card = "bg-white dark:bg-crypto-color border border-gray-200 dark:border-line-color rounded-2xl";
const field = "bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-gray-300 dark:border-line-color rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";
const th = "px-4 py-3 font-medium whitespace-nowrap";
const td = "px-4 py-3 align-top";

const ASSETS = ["ZAR", "USD", "BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA", "USDT"];
const DEPOSIT_STATUSES = ["PENDING", "DETECTED", "CONFIRMING", "COMPLETED", "FAILED", "UNDER_REVIEW"];
const WITHDRAWAL_STATUSES = ["PENDING_CONFIRMATION", "PROCESSING", "COMPLETED", "FAILED", "UNDER_REVIEW", "REJECTED", "CANCELLED", "EXPIRED"];

const query = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined)).toString();

const Pager = ({ pagination, page, setPage }) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-line-color text-sm text-gray-600 dark:text-gray-400">
      <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-line-color disabled:opacity-40">Previous</button>
        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-line-color disabled:opacity-40">Next</button>
      </div>
    </div>
  );
};

const ListState = ({ list, colSpan, empty }) => {
  if (list.loading) return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">Loading…</td></tr>;
  if (list.error) return <tr><td colSpan={colSpan} role="alert" className="px-4 py-8 text-center text-sm text-red-600 dark:text-red-400">{list.error}</td></tr>;
  if (empty) return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">No records match these filters.</td></tr>;
  return null;
};

const Filters = ({ search, setSearch, status, setStatus, statuses, asset, setAsset, placeholder }) => (
  <div className="flex flex-wrap gap-3 mb-4">
    <label className="sr-only" htmlFor="fin-search">Search</label>
    <input id="fin-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} className={`${field} w-full max-w-80`} />
    <label className="sr-only" htmlFor="fin-status">Status</label>
    <select id="fin-status" value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
      <option value="">All statuses</option>
      {statuses.map((s) => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
    </select>
    <label className="sr-only" htmlFor="fin-asset">Currency or asset</label>
    <select id="fin-asset" value={asset} onChange={(e) => setAsset(e.target.value)} className={field}>
      <option value="">All currencies</option>
      {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
    </select>
  </div>
);

const Detail = ({ label, children }) => (
  <div className="flex justify-between gap-4 text-sm py-1">
    <span className="text-gray-600 dark:text-gray-400 shrink-0">{label}</span>
    <span className="text-right break-all">{children ?? "—"}</span>
  </div>
);

const LedgerList = ({ ledger }) => (
  <div>
    <h4 className="font-semibold text-sm mt-4 mb-2">Ledger journals</h4>
    {ledger.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">None posted.</p> : ledger.map((j) => (
      <div key={j.id} className="mb-2 rounded-lg bg-slate-100 dark:bg-input-field p-3 text-xs">
        <p className="font-semibold">{j.kind} <span className="font-normal text-gray-600 dark:text-gray-400">· {new Date(j.created_at).toLocaleString()}</span></p>
        <ul className="mt-1 space-y-0.5 font-mono">
          {j.entries.map((e, i) => <li key={i}>{e.account} {Number(e.amount) > 0 ? "+" : ""}{e.amount} {e.asset}</li>)}
        </ul>
      </div>
    ))}
  </div>
);

const EventList = ({ events }) => (
  <div>
    <h4 className="font-semibold text-sm mt-4 mb-2">Provider events</h4>
    {events.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">None received.</p> : (
      <ul className="text-xs space-y-1">
        {events.map((e) => <li key={e.id}><span className="font-mono">{e.event_type}</span> → {e.outcome || "pending"} · {new Date(e.received_at).toLocaleString()}</li>)}
      </ul>
    )}
  </div>
);

// ---------------------------------------------------------------- deposits

export const DepositsPanel = ({ initialStatus = "" }) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [asset, setAsset] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const list = useApi(
    () => authFetch(`/api/admin/deposits?${query({ page, limit: 20, search: search.trim(), status, asset })}`),
    [page, search, status, asset]
  );
  const detail = useApi(() => authFetch(`/api/admin/deposits/${openId}`), [openId], { enabled: openId !== null });
  const rows = list.data?.deposits || [];
  const reset = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <div>
      <Filters search={search} setSearch={reset(setSearch)} status={status} setStatus={reset(setStatus)} statuses={DEPOSIT_STATUSES}
        asset={asset} setAsset={reset(setAsset)} placeholder="Reference, tx hash or customer email" />
      <div className={`${card} overflow-x-auto relative`}>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600 dark:text-text-color border-b border-gray-200 dark:border-line-color">
            <tr><th className={th}>Date</th><th className={th}>Customer</th><th className={th}>Type</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}>Reference / tx</th><th className={th}><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            <ListState list={list} colSpan={7} empty={rows.length === 0} />
            {!list.loading && rows.map((d) => (
              <tr key={d.id} className="border-b border-gray-200 dark:border-line-color/50">
                <td className={`${td} whitespace-nowrap text-gray-600 dark:text-gray-400`}>{new Date(d.created_at).toLocaleString()}</td>
                <td className={td}>{d.user_email}</td>
                <td className={td}>{d.type === "FIAT" ? `Fiat · ${d.payment_method || "—"}` : `Crypto · ${d.network}`}</td>
                <td className={`${td} whitespace-nowrap`}>{formatAmount(d.amount, d.asset)}</td>
                <td className={td}>
                  <StatusBadge status={d.status} />
                  {d.type === "CRYPTO" && !["COMPLETED", "FAILED"].includes(d.status) && <span className="block text-xs text-gray-600 dark:text-gray-400 mt-1">{d.confirmations}/{d.required_confirmations} conf.</span>}
                </td>
                <td className={`${td} font-mono text-xs break-all max-w-56`}>{d.provider_reference}{d.tx_hash && <span className="block text-gray-600 dark:text-gray-400">{d.tx_hash}</span>}</td>
                <td className={td}><button type="button" onClick={() => setOpenId(d.id)} className="text-blue-600 dark:text-blue-400 text-xs font-semibold">Details</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager pagination={list.data?.pagination} page={page} setPage={setPage} />
      </div>

      {openId !== null && (
        <Modal onClose={() => setOpenId(null)} titleId="deposit-detail-title" className="bg-white dark:bg-crypto-color border border-gray-200 dark:border-line-color rounded-2xl p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto text-slate-900 dark:text-white">
          <div className="flex justify-between items-start mb-4">
            <h3 id="deposit-detail-title" className="text-lg font-bold">Deposit #{openId}</h3>
            <button type="button" onClick={() => setOpenId(null)} aria-label="Close dialog">✕</button>
          </div>
          {detail.loading && <p className="text-sm">Loading…</p>}
          {detail.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{detail.error}</p>}
          {detail.data && (() => {
            const d = detail.data.deposit;
            return (
              <>
                <div className="mb-3"><StatusBadge status={d.status} /></div>
                <Detail label="Customer">{d.user_email}</Detail>
                <Detail label="Amount">{formatAmount(d.amount, d.asset)}</Detail>
                <Detail label="Fee">{formatAmount(d.fee, d.asset)}</Detail>
                <Detail label="Credited">{formatAmount(d.net_amount, d.asset)}</Detail>
                <Detail label="Provider">{d.provider}</Detail>
                <Detail label="Reference">{d.provider_reference}</Detail>
                {d.tx_hash && <Detail label="Tx hash">{d.tx_hash}</Detail>}
                {d.deposit_address && <Detail label="Address">{d.deposit_address}</Detail>}
                {d.type === "CRYPTO" && <Detail label="Confirmations">{d.confirmations}/{d.required_confirmations}</Detail>}
                {d.failure_reason && <Detail label="Review note">{d.failure_reason}</Detail>}
                <Detail label="Created">{new Date(d.created_at).toLocaleString()}</Detail>
                {d.completed_at && <Detail label="Completed">{new Date(d.completed_at).toLocaleString()}</Detail>}
                <LedgerList ledger={detail.data.ledger} />
                <EventList events={detail.data.providerEvents} />
              </>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- withdrawals

export const WithdrawalsPanel = ({ initialStatus = "" }) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [asset, setAsset] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const list = useApi(
    () => authFetch(`/api/admin/withdrawals?${query({ page, limit: 20, search: search.trim(), status, asset })}`),
    [page, search, status, asset]
  );
  const detail = useApi(() => authFetch(`/api/admin/withdrawals/${openId}`), [openId], { enabled: openId !== null });
  const rows = list.data?.withdrawals || [];
  const reset = (setter) => (value) => { setter(value); setPage(1); };

  const open = (id) => { setOpenId(id); setReason(""); setActionMessage(null); };

  const act = async (path, body) => {
    setBusy(true);
    setActionMessage(null);
    try {
      const data = await authFetch(`/api/admin/withdrawals/${openId}/${path}`, { method: "POST", body: JSON.stringify(body || {}) });
      setActionMessage({ kind: "ok", text: data.message });
      detail.reload();
      list.reload();
    } catch (err) {
      setActionMessage({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Filters search={search} setSearch={reset(setSearch)} status={status} setStatus={reset(setStatus)} statuses={WITHDRAWAL_STATUSES}
        asset={asset} setAsset={reset(setAsset)} placeholder="WD-reference, tx hash, address or email" />
      <div className={`${card} overflow-x-auto relative`}>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600 dark:text-text-color border-b border-gray-200 dark:border-line-color">
            <tr><th className={th}>Date</th><th className={th}>Reference</th><th className={th}>Customer</th><th className={th}>Amount</th><th className={th}>Destination</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            <ListState list={list} colSpan={7} empty={rows.length === 0} />
            {!list.loading && rows.map((w) => (
              <tr key={w.id} className="border-b border-gray-200 dark:border-line-color/50">
                <td className={`${td} whitespace-nowrap text-gray-600 dark:text-gray-400`}>{new Date(w.created_at).toLocaleString()}</td>
                <td className={`${td} font-mono text-xs`}>{w.reference}</td>
                <td className={td}>{w.user_email}</td>
                <td className={`${td} whitespace-nowrap`}>{formatAmount(w.amount, w.asset)}</td>
                <td className={`${td} text-xs break-all max-w-56`}>{w.type === "FIAT" ? `${w.bank_name || "Bank"} ${w.bank_account_masked || ""}` : `${w.network} · ${w.destination_address}`}</td>
                <td className={td}><StatusBadge status={w.status} /></td>
                <td className={td}><button type="button" onClick={() => open(w.id)} className="text-blue-600 dark:text-blue-400 text-xs font-semibold">Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager pagination={list.data?.pagination} page={page} setPage={setPage} />
      </div>

      {openId !== null && (
        <Modal onClose={() => setOpenId(null)} titleId="withdrawal-detail-title" className="bg-white dark:bg-crypto-color border border-gray-200 dark:border-line-color rounded-2xl p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto text-slate-900 dark:text-white">
          <div className="flex justify-between items-start mb-4">
            <h3 id="withdrawal-detail-title" className="text-lg font-bold">Withdrawal WD-{openId}</h3>
            <button type="button" onClick={() => setOpenId(null)} aria-label="Close dialog">✕</button>
          </div>
          {detail.loading && <p className="text-sm">Loading…</p>}
          {detail.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{detail.error}</p>}
          {detail.data && (() => {
            const w = detail.data.withdrawal;
            const risk = detail.data.risk;
            return (
              <>
                <div className="mb-3"><StatusBadge status={w.status} /></div>
                <Detail label="Customer">{w.user_email}</Detail>
                <Detail label="Amount">{formatAmount(w.amount, w.asset)}</Detail>
                <Detail label="Fee">{formatAmount(w.fee, w.asset)}</Detail>
                <Detail label="Payout">{formatAmount(w.receive_amount, w.asset)}</Detail>
                {w.type === "FIAT" ? (
                  <Detail label="To">{w.bank_details?.accountHolderName} · {w.bank_details?.bankName} {w.bank_details?.accountNumberMasked}{w.bank_details?.branchCode ? ` · branch ${w.bank_details.branchCode}` : ""}</Detail>
                ) : (
                  <Detail label="To">{w.network} · {w.destination_address}{w.memo ? ` · memo ${w.memo}` : ""}</Detail>
                )}
                <Detail label="Provider">{w.provider}</Detail>
                <Detail label="Provider status">{w.provider_status}</Detail>
                <Detail label="Provider reference">{w.provider_reference}</Detail>
                {w.tx_hash && <Detail label="Tx hash">{w.tx_hash}</Detail>}
                {w.failure_reason && <Detail label="Note">{w.failure_reason}</Detail>}

                <h4 className="font-semibold text-sm mt-4 mb-1">Risk context</h4>
                <Detail label="Account created">{new Date(risk.account_created_at).toLocaleDateString()}</Detail>
                <Detail label="Completed withdrawals">{risk.completed_withdrawals}</Detail>
                <Detail label="Withdrawals in last 24h">{risk.withdrawals_last_24h}</Detail>
                <Detail label="Paid this destination before">{risk.previous_payouts_to_destination > 0 ? `Yes (${risk.previous_payouts_to_destination})` : "No — new destination"}</Detail>

                {w.status === "PENDING_CONFIRMATION" && (
                  <div className="mt-4 space-y-2">
                    <label htmlFor="reject-reason" className="block text-sm font-semibold">Reject before it's confirmed</label>
                    <textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={`${field} w-full`} placeholder="Reason (required, recorded in the audit log)" />
                    <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => act("reject", { reason: reason.trim() })} className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50">
                      Reject and release funds
                    </button>
                  </div>
                )}

                {["PROCESSING", "UNDER_REVIEW"].includes(w.status) && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Ask the provider for this payout's status. Money only moves on a definite answer.</p>
                    <button type="button" disabled={busy} onClick={() => act("recheck")} className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">
                      Re-check with provider
                    </button>
                  </div>
                )}

                {actionMessage && (
                  <p role={actionMessage.kind === "error" ? "alert" : "status"} className={`mt-3 text-sm ${actionMessage.kind === "error" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{actionMessage.text}</p>
                )}

                <LedgerList ledger={detail.data.ledger} />
                <EventList events={detail.data.providerEvents} />
              </>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- reconciliation

export const ReconciliationPanel = () => {
  const rec = useApi(() => authFetch("/api/admin/reconciliation"), []);
  const r = rec.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Compares every wallet balance with the ledger and lists anything held for review or stuck with a provider.
          {r && ` Checked ${new Date(r.checkedAt).toLocaleString()}.`}
        </p>
        <button type="button" onClick={rec.reload} className="px-4 py-2 rounded-full border border-gray-300 dark:border-line-color text-sm font-semibold">Run again</button>
      </div>

      {rec.loading && <p className="text-sm">Reconciling…</p>}
      {rec.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{rec.error}</p>}

      {r && (
        <>
          <div role="status" className={`${card} p-5 ${r.ok ? "border-green-500/40" : "border-red-500/40"}`}>
            <p className="text-lg font-bold">{r.ok ? "Everything reconciles" : `${r.exceptions} exception${r.exceptions === 1 ? "" : "s"} need attention`}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ledger vs wallet mismatches: {r.ledger.balanceMismatches.length} · Unbalanced journals: {r.ledger.unbalancedJournals.length}
            </p>
          </div>

          {r.ledger.balanceMismatches.length > 0 && (
            <section className={`${card} p-5`}>
              <h3 className="font-semibold mb-2">Balance mismatches</h3>
              <ul className="text-sm font-mono space-y-1">
                {r.ledger.balanceMismatches.map((m) => (
                  <li key={`${m.user_id}-${m.asset}`}>user {m.user_id} {m.asset}: wallet {m.wallet_available}/{m.wallet_locked} vs ledger {m.ledger_available}/{m.ledger_locked}</li>
                ))}
              </ul>
            </section>
          )}

          {[["Deposits needing attention", r.depositsNeedingAttention], ["Withdrawals needing attention", r.withdrawalsNeedingAttention]].map(([title, items]) => (
            <section key={title} className={`${card} p-5`}>
              <h3 className="font-semibold mb-2">{title} ({items.length})</h3>
              {items.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">None.</p> : (
                <ul className="text-sm divide-y divide-gray-200 dark:divide-line-color">
                  {items.map((x) => (
                    <li key={x.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                      <span>#{x.id} · {x.user_email} · {formatAmount(x.amount, x.asset)} · {x.provider || "—"}</span>
                      <span className="flex items-center gap-2"><StatusBadge status={x.status} /></span>
                      {x.failure_reason && <span className="w-full text-xs text-gray-600 dark:text-gray-400">{x.failure_reason}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className={`${card} p-5`}>
            <h3 className="font-semibold mb-2">Unmatched provider events ({r.unmatchedProviderEvents.length})</h3>
            {r.unmatchedProviderEvents.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">None.</p> : (
              <ul className="text-sm space-y-1">
                {r.unmatchedProviderEvents.map((e) => <li key={e.id}><span className="font-mono">{e.event_type}</span> from {e.provider}: {e.outcome} · {new Date(e.received_at).toLocaleString()}</li>)}
              </ul>
            )}
          </section>

          <section className={`${card} p-5 overflow-x-auto relative`}>
            <h3 className="font-semibold mb-1">Platform accounts</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Fees earned, the exchange's trading inventory, and money that entered or left through each provider (negative = net inflow).</p>
            <table className="text-sm w-full">
              <thead className="text-left text-gray-600 dark:text-text-color"><tr><th className={th}>Account</th><th className={th}>Asset</th><th className={th}>Balance</th></tr></thead>
              <tbody>
                {r.platformAccounts.map((a) => (
                  <tr key={`${a.account}-${a.asset}`} className="border-t border-gray-200 dark:border-line-color/50"><td className={`${td} font-mono text-xs`}>{a.account}</td><td className={td}>{a.asset}</td><td className={`${td} font-mono`}>{a.balance}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- audit log

export const AuditLogPanel = () => {
  const [page, setPage] = useState(1);
  const logs = useApi(() => authFetch(`/api/admin/audit-logs?page=${page}&limit=25`), [page]);
  const rows = logs.data?.auditLogs || [];

  return (
    <div className={`${card} overflow-x-auto relative`}>
      <table className="w-full text-sm">
        <thead className="text-left text-gray-600 dark:text-text-color border-b border-gray-200 dark:border-line-color">
          <tr><th className={th}>When</th><th className={th}>Administrator</th><th className={th}>Action</th><th className={th}>Target</th><th className={th}>Reason</th><th className={th}>Change</th></tr>
        </thead>
        <tbody>
          <ListState list={logs} colSpan={6} empty={rows.length === 0} />
          {!logs.loading && rows.map((a) => (
            <tr key={a.id} className="border-b border-gray-200 dark:border-line-color/50">
              <td className={`${td} whitespace-nowrap text-gray-600 dark:text-gray-400`}>{new Date(a.created_at).toLocaleString()}</td>
              <td className={td}>{a.actor_email || "—"}</td>
              <td className={`${td} font-mono text-xs`}>{a.action}</td>
              <td className={td}>{a.target_type} {a.target_id}</td>
              <td className={`${td} max-w-64`}>{a.reason || "—"}</td>
              <td className={`${td} font-mono text-xs max-w-72 break-all`}>{a.before_state ? JSON.stringify(a.before_state) : "—"} → {a.after_state ? JSON.stringify(a.after_state) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager pagination={logs.data?.pagination} page={page} setPage={setPage} />
    </div>
  );
};

// ---------------------------------------------------------------- assets

export const AssetsPanel = () => {
  const assets = useApi(() => authFetch("/api/admin/assets"), []);
  const a = assets.data;

  return (
    <div className="space-y-6">
      {assets.loading && <p className="text-sm">Loading…</p>}
      {assets.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{assets.error}</p>}
      {a && (
        <>
          <div className={`${card} p-5 text-sm`}>
            <p>Payment provider: <strong>{a.paymentProvider}</strong> · Custody provider: <strong>{a.custodyProvider}</strong></p>
            {a.demo && <p className="mt-1 text-amber-700 dark:text-amber-300">Demo integrations are active: no real money or crypto moves.</p>}
          </div>
          <section className={`${card} overflow-x-auto relative`}>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600 dark:text-text-color border-b border-gray-200 dark:border-line-color">
                <tr><th className={th}>Fiat</th><th className={th}>Deposit limits</th><th className={th}>Deposit fees</th><th className={th}>Withdrawal limits</th><th className={th}>Withdrawal fee</th></tr>
              </thead>
              <tbody>
                {a.fiat.map((f) => (
                  <tr key={f.code} className="border-b border-gray-200 dark:border-line-color/50">
                    <td className={td}>{f.code} · {f.name}</td>
                    <td className={td}>{formatAmount(f.deposit.min, f.code)}–{formatAmount(f.deposit.max, f.code)}</td>
                    <td className={td}>{Object.entries(f.deposit.feeRates).map(([m, r]) => `${m} ${Number(r) * 100}%`).join(" · ")}</td>
                    <td className={td}>{formatAmount(f.withdrawal.min, f.code)}–{formatAmount(f.withdrawal.max, f.code)}</td>
                    <td className={td}>{Number(f.withdrawal.feeRate) * 100}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className={`${card} overflow-x-auto relative`}>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600 dark:text-text-color border-b border-gray-200 dark:border-line-color">
                <tr><th className={th}>Crypto</th><th className={th}>Networks</th><th className={th}>Min deposit</th><th className={th}>Confirmations</th><th className={th}>Withdrawal fee</th></tr>
              </thead>
              <tbody>
                {a.crypto.map((c) => (
                  <tr key={c.asset} className="border-b border-gray-200 dark:border-line-color/50">
                    <td className={td}>{c.asset}</td>
                    <td className={td}>{c.networks.map((n) => `${n.label}${n.requiresMemo ? " (memo)" : ""}`).join(", ")}</td>
                    <td className={td}>{c.minDeposit}</td>
                    <td className={td}>{c.requiredConfirmations}</td>
                    <td className={td}>{c.withdrawalFee} {c.asset}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
};

