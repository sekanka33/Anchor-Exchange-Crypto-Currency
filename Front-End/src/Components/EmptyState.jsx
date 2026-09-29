/**
 * Themed "not available yet" panel — used for features that have no backend
 * support (API keys, login history, 2FA, referrals) and for leftover stub
 * routes with no dedicated Figma design (Assets, Pages, Bitusdt, Enusd).
 * Deliberately honest rather than showing fabricated data.
 */
const EmptyState = ({ icon, title, description }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6 rounded-2xl border border-gray-200 dark:border-line-color bg-white dark:bg-crypto-color">
      {icon && (
        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-hero-dark flex items-center justify-center text-2xl text-gray-400 dark:text-text-color">
          {icon}
        </div>
      )}

      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>

      {description && (
        <p className="text-sm text-gray-500 dark:text-text-color max-w-md">{description}</p>
      )}
    </div>
  );
};

export default EmptyState;
