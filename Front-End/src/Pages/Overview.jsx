import React from "react";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";

const Overview = () => {
  return (
    <div>

      <div className="pr-20 pl-20 pt-10 h-27 w-full bg-mist-900">
        <h1 className="text-2xl font-semibold">
          Crypto Overview
        </h1>
      </div>

      <div className="flex flex-row gap-30 pt-20 pb-20 pr-30 pl-30">

        {/* SIDEBAR */}
        <div className="flex flex-col justify-center gap-7 pb-50">

          <Link
            to="/overview"
            className="w-50 h-10 flex items-center px-4 rounded-full bg-blue-500"
          >
            Overview
          </Link>

          <Link
            to="/buy-crypto"
            className="w-50 h-10 flex items-center px-4 rounded-full hover:bg-blue-500 transition-colors"
          >
            Buy Crypto
          </Link>

          <Link
            to="/sell-crypto"
            className="w-50 h-10 flex items-center px-4 rounded-full hover:bg-blue-500 transition-colors"
          >
            Sell Crypto
          </Link>

        </div>

        <div className="h-140 w-0 border-r-2 border-hero-dark"></div>

        {/* CONTENT */}
        <div className="text-white max-w-3xl">

          <h2 className="text-3xl font-bold mb-4">
            Crypto Overview
          </h2>

          <p className="text-gray-400 mb-8">
            Track cryptocurrency prices, market movements
            and discover assets available on Anchor Exchange.
          </p>

          <div className="grid grid-cols-3 gap-4">

            <div className="bg-[#16181e] p-6 rounded-2xl">
              <p className="text-gray-400 text-sm">
                Buy Crypto
              </p>

              <Link
                to="/buy-crypto"
                className="inline-block mt-4 bg-blue-500 px-5 py-2 rounded-full text-sm"
              >
                Buy
              </Link>
            </div>

            <div className="bg-[#16181e] p-6 rounded-2xl">
              <p className="text-gray-400 text-sm">
                Sell Crypto
              </p>

              <Link
                to="/sell-crypto"
                className="inline-block mt-4 bg-blue-500 px-5 py-2 rounded-full text-sm"
              >
                Sell
              </Link>
            </div>

            <div className="bg-[#16181e] p-6 rounded-2xl">
              <p className="text-gray-400 text-sm">
                Market
              </p>

              <Link
                to="/"
                className="inline-block mt-4 bg-blue-500 px-5 py-2 rounded-full text-sm"
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