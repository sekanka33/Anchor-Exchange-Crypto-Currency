import { useNavigate } from "react-router-dom";
import { FiMoon, FiSun, FiLogOut } from "react-icons/fi";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";

const AdminHeader = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate("/signin", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 h-14 px-4 md:px-6 bg-white dark:bg-[#0d0e12] border-b border-gray-200 dark:border-gray-800 text-sm text-slate-900 dark:text-white transition-colors duration-300">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg font-bold whitespace-nowrap">Anchor Exchange</span>
        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
      </div>

      <div className="flex items-center gap-3 min-w-0">
        {user?.email && (
          <span className="hidden sm:block truncate text-gray-600 dark:text-gray-400" title={user.email}>{user.email}</span>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className="text-slate-600 dark:text-gray-300 hover:text-blue-500 text-xl p-1 rounded-full transition-colors"
          aria-label="Toggle theme layout"
        >
          {isDarkMode ? <FiSun /> : <FiMoon />}
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 rounded-full px-3 py-1 text-xs hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-colors"
        >
          <FiLogOut aria-hidden="true" /> Sign out
        </button>
      </div>
    </header>
  );
};

export default AdminHeader;
