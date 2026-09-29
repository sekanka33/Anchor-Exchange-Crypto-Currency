import { Link, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/overview", label: "Overview" },
  { to: "/buy-crypto", label: "Buy Crypto" },
  { to: "/sell-crypto", label: "Sell Crypto" },
  { to: "/deposit", label: "Deposit" },
  { to: "/deposit/crypto", label: "Receive Crypto" },
  { to: "/withdraw", label: "Withdraw" },
  { to: "/withdraw/crypto", label: "Send Crypto" },
  { to: "/transactions", label: "Transactions" },
  { to: "/orderstrades", label: "Orders & Trades" },
];

/**
 * Shared local pill-nav reused across every money-flow page (Overview, Wallet,
 * Buy/Sell Crypto, Deposit/Withdraw x2, Transactions, Orders & Trades) —
 * previously hand-duplicated per page.
 */
const MoneyFlowSidebar = () => {
  const location = useLocation();

  return (
    <div className="flex flex-row md:flex-col md:justify-center gap-3 md:gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0 [&>a]:flex-shrink-0">
      {LINKS.map((link) => {
        const isActive = location.pathname === link.to;

        return (
          <Link
            key={link.to}
            to={link.to}
            aria-current={isActive ? "page" : undefined}
            className={`w-50 h-10 flex items-center px-4 rounded-full transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-slate-900 dark:text-white hover:bg-blue-600 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
};

export default MoneyFlowSidebar;
