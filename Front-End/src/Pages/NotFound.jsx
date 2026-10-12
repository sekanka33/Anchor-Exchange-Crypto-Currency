import { Link } from "react-router-dom";
import PageHeader from "../Components/PageHeader";
import EmptyState from "../Components/EmptyState";

const NotFound = () => {
  return (
    <div>
      <PageHeader title="Page not found" crumbs={[{ label: "Home", to: "/" }, { label: "Not found" }]} />
      <div className="max-w-2xl mx-auto px-4 py-14 flex flex-col items-center gap-6">
        <EmptyState
          icon="🧭"
          title="We couldn't find that page"
          description="The link may be broken, or the page may have moved."
        />
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-5 rounded-full flex items-center text-sm font-medium">
            Back to Home
          </Link>
          <Link to="/markets" className="border border-gray-300 dark:border-gray-600 h-10 px-5 rounded-full flex items-center text-sm font-medium hover:border-blue-500">
            View Markets
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
