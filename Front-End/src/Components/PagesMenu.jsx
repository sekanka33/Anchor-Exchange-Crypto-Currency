import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

// The pages a client needs, grouped by purpose. Account pages only make sense
// once signed in (they're behind ProtectedRoute), so guests get sign-in links.
const getGroups = (loggedIn) => [
  loggedIn
    ? {
        title: 'My account',
        links: [
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/wallet', label: 'Wallet' },
          { to: '/deposit', label: 'Deposit' },
          { to: '/withdraw', label: 'Withdraw' },
          { to: '/sell-crypto', label: 'Sell Crypto' },
          { to: '/transactions', label: 'Transaction History' },
          { to: '/notifications', label: 'Notifications' },
          { to: '/profile-setting', label: 'Profile & Settings' },
        ],
      }
    : {
        title: 'Get started',
        links: [
          { to: '/signin', label: 'Sign In' },
          { to: '/signup', label: 'Create Account' },
        ],
      },
  {
    title: 'Markets',
    links: [
      { to: '/overview', label: 'Crypto Overview' },
      { to: '/markets', label: 'Markets' },
      { to: '/buy-crypto', label: 'Buy Crypto' },
    ],
  },
  {
    title: 'Help & info',
    links: [
      { to: '/faq', label: 'Help Center' },
      { to: '/contact', label: 'Contact Us' },
      { to: '/blog', label: 'Blog' },
    ],
  },
];

const linkClass = ({ isActive }) =>
  `block px-3 py-1.5 rounded-lg transition-colors ${
    isActive ? 'text-blue-500 bg-blue-500/10' : 'text-slate-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-input-field hover:text-blue-500'
  }`;

// Desktop: "Pages ▼" button with a grouped dropdown panel.
export const PagesMenu = ({ loggedIn }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  const groups = getGroups(loggedIn);
  const onAPage = groups.some((g) => g.links.some((l) => l.to === pathname));

  // Close on outside click and Escape (links close it on click).
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative h-full flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`px-4 h-full flex items-center space-x-1 transition-colors hover:text-blue-500 ${onAPage || open ? 'text-blue-500' : ''}`}
      >
        <span>Pages</span>
        <span className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">▼</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[34rem] grid grid-cols-3 gap-4 p-4 rounded-xl border shadow-2xl z-50 bg-white dark:bg-crypto-color border-gray-200 dark:border-line-color text-sm font-normal">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-color">{group.title}</p>
              <ul className="space-y-0.5">
                {group.links.map((l) => (
                  <li key={l.to}>
                    <NavLink to={l.to} end onClick={() => setOpen(false)} className={linkClass}>{l.label}</NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Mobile: the same groups as a flat, always-open list inside the menu drawer.
export const PagesMenuList = ({ loggedIn, onNavigate }) => (
  <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-line-color">
    {getGroups(loggedIn).map((group) => (
      <div key={group.title}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-color">{group.title}</p>
        <ul className="grid grid-cols-2 gap-x-2">
          {group.links.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end onClick={onNavigate} className={linkClass}>{l.label}</NavLink>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);
