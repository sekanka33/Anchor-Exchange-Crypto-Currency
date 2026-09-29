import { Link } from "react-router-dom";

/**
 * Shared light-gray title + breadcrumb strip used under the navbar on every
 * interior (logged-in-context) page, matching the Figma "Rocket" reference.
 */
const PageHeader = ({ title, crumbs = [] }) => {
  return (
    <div className="px-4 md:px-16 lg:px-30 py-6 md:py-10 w-full bg-slate-100 dark:bg-dark-void border-b border-gray-200 dark:border-line-color">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>

        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="text-sm text-gray-600 dark:text-text-color">
            <ol className="flex items-center gap-2">
              {crumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden="true">/</span>}
                  {crumb.to ? (
                    <Link to={crumb.to} className="text-gray-600 dark:text-text-color hover:text-blue-600 dark:hover:text-blue-400">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
