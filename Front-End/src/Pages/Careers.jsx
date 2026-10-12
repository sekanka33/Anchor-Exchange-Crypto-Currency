import { Link } from "react-router-dom";
import PageHeader from "../Components/PageHeader";
import EmptyState from "../Components/EmptyState";

const Careers = () => {
  return (
    <div>
      <PageHeader title="Careers" crumbs={[{ label: "Home", to: "/" }, { label: "Careers" }]} />
      <div className="max-w-2xl mx-auto px-4 py-14 flex flex-col items-center gap-6">
        <EmptyState
          icon="💼"
          title="No open positions"
          description="Anchor Exchange doesn't have any job openings listed right now. New roles will be posted on this page."
        />
        <Link to="/about" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Learn about Anchor Exchange →
        </Link>
      </div>
    </div>
  );
};

export default Careers;
