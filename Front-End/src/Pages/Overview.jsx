import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";

const Overview = () => {
  return (
    <div>
      <PageHeader title="Crypto Overview" crumbs={[{ label: "Home", to: "/" }, { label: "Overview" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">

        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        {/* CONTENT */}
        <div className="text-slate-900 dark:text-white w-full max-w-3xl">

          <h2 className="text-3xl font-bold mb-4">
            Crypto Overview
          </h2>

          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Track cryptocurrency prices, market movements
            and discover assets available on Anchor Exchange.
          </p>

          <div className="grid grid-cols-3 gap-4">

            <div className="bg-white dark:bg-[#16181e] p-6 rounded-2xl border border-gray-200 dark:border-transparent">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Buy Crypto
              </p>

              <Link
                to="/buy-crypto"
                className="inline-block mt-4 bg-blue-600 px-5 py-2 rounded-full text-sm text-white"
              >
                Buy
              </Link>
            </div>

            <div className="bg-white dark:bg-[#16181e] p-6 rounded-2xl border border-gray-200 dark:border-transparent">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Sell Crypto
              </p>

              <Link
                to="/sell-crypto"
                className="inline-block mt-4 bg-blue-600 px-5 py-2 rounded-full text-sm text-white"
              >
                Sell
              </Link>
            </div>

            <div className="bg-white dark:bg-[#16181e] p-6 rounded-2xl border border-gray-200 dark:border-transparent">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Market
              </p>

              <Link
                to="/"
                className="inline-block mt-4 bg-blue-600 px-5 py-2 rounded-full text-sm text-white"
              >
                View Market
              </Link>
            </div>

          </div>

        </div>

      </div>

      <CreateAnAccoutSection />

    </div>
  );
};

export default Overview;
