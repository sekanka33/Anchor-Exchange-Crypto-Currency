import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import { getCoinPrice } from "../api/coingecko";

const cryptocurrencies = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    icon: "₿",
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    icon: "Ξ",
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    icon: "₿",
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    icon: "S",
  },
  {
    id: "tether",
    symbol: "USDT",
    name: "Tether",
    icon: "₮",
  },
];

const SellCrypto = () => {
  const [selectedCoin, setSelectedCoin] = useState(
    cryptocurrencies[0]
  );

  const [amount, setAmount] = useState("0.001");

  const [price, setPrice] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [step, setStep] = useState(1);

  const [showDropdown, setShowDropdown] = useState(false);

  const feePercentage = 0.01;

  const fetchPrice = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getCoinPrice(selectedCoin.id);

      const currentPrice = data[selectedCoin.id]?.usd;

      if (!currentPrice) {
        throw new Error("Price unavailable");
      }

      setPrice(currentPrice);
    } catch (err) {
      console.error(err);
      setError("Unable to load the current crypto price.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();

    const interval = setInterval(() => {
      fetchPrice();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedCoin]);

  const cryptoAmount = Number(amount) || 0;

  const grossUSD = cryptoAmount * (price || 0);

  const fee = grossUSD * feePercentage;

  const receiveUSD = grossUSD - fee;

  const handleContinue = (e) => {
    e.preventDefault();

    if (!amount || cryptoAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!price) {
      setError("Crypto price is not available yet.");
      return;
    }

    setError("");
    setStep(2);
  };

  const formatUSD = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div>

      {/* HEADER */}
      <div className="pr-20 pl-20 pt-10 h-27 w-full bg-mist-900">
        <h1 className="text-2xl font-semibold">
          Sell Crypto
        </h1>
      </div>

      <div className="flex flex-row gap-30 pt-20 pb-20 pr-30 pl-30">

        {/* SIDEBAR */}
        <div className="flex flex-col justify-center gap-7 pb-50">

          <Link
            to="/overview"
            className="w-50 h-10 flex items-center px-4 rounded-full hover:bg-blue-500 transition-colors"
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
            className="w-50 h-10 flex items-center px-4 rounded-full bg-blue-500"
          >
            Sell Crypto
          </Link>

        </div>

        <div className="h-140 w-0 border-r-2 border-hero-dark"></div>

        {/* MAIN */}
        <div className="text-white font-sans">

          {/* PROGRESS */}
          <div className="flex items-center gap-4 text-sm font-semibold mb-8 pl-7">

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-green-500 flex items-center justify-center p-0.5">
                <div className="w-full h-full bg-green-500 rounded-full"></div>
              </div>

              <span>
                Select currency
              </span>
            </div>

            <div className="text-gray-600">
              --------
            </div>

            <div className={`flex items-center gap-2 ${
              step >= 2 ? "text-white" : "text-gray-400"
            }`}>

              <div className={`w-3 h-3 rounded-full ${
                step >= 2
                  ? "bg-green-500"
                  : "bg-white"
              }`}></div>

              <span>
                Important Notes
              </span>

            </div>

            <div className="text-gray-600">
              --------
            </div>

            <div className={`flex items-center gap-2 ${
              step >= 3 ? "text-white" : "text-gray-400"
            }`}>

              <div className={`w-3 h-3 rounded-full ${
                step >= 3
                  ? "bg-green-500"
                  : "bg-white"
              }`}></div>

              <span>
                Payment Details
              </span>

            </div>

          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-800/50 shadow-xl">

              <h2 className="text-2xl font-bold mb-1">
                Sell Crypto
              </h2>

              <p className="text-xs text-gray-400 mb-6">

                {loading ? (
                  "Loading current price..."
                ) : price ? (
                  `Reference Price: ${formatUSD(price)} / ${selectedCoin.symbol}`
                ) : (
                  "Price unavailable"
                )}

              </p>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleContinue}>

                <div className="flex items-end gap-3 mb-6">

                  {/* CRYPTO */}
                  <div className="flex-1">

                    <label className="block text-base font-semibold text-gray-300 mb-2">
                      Sell
                    </label>

                    <div className="flex items-center bg-input-field border border-blue-500 rounded-xl px-4 py-3">

                      <input
                        type="number"
                        min="0"
                        step="0.00000001"
                        value={amount}
                        onChange={(e) =>
                          setAmount(e.target.value)
                        }
                        className="w-full bg-transparent outline-none text-white text-sm"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowDropdown(!showDropdown)
                        }
                        className="flex items-center gap-2 ml-2"
                      >

                        <span className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-xs">
                          {selectedCoin.icon}
                        </span>

                        {selectedCoin.symbol}

                        <span className="text-gray-400">
                          ▼
                        </span>

                      </button>

                    </div>

                    {showDropdown && (
                      <div className="absolute mt-2 bg-[#21242d] border border-gray-700 rounded-xl overflow-hidden z-50">

                        {cryptocurrencies.map((coin) => (
                          <button
                            key={coin.id}
                            type="button"
                            onClick={() => {
                              setSelectedCoin(coin);
                              setShowDropdown(false);
                            }}
                            className="w-full px-5 py-3 text-left hover:bg-blue-500/20"
                          >
                            {coin.icon} {coin.symbol}
                          </button>
                        ))}

                      </div>
                    )}

                  </div>

                  <div className="bg-blue-500 p-3 rounded-full">
                    <img src="/src/assets/Group 564.png" alt="Exchange icon" />
                  </div>

                  {/* USD */}
                  <div className="flex-1">

                    <label className="block text-base font-semibold text-gray-300 mb-2">
                      Receive
                    </label>

                    <div className="flex items-center bg-[#21242d] rounded-xl px-4 py-3">

                      <input
                        type="text"
                        readOnly
                        value={
                          price
                            ? formatUSD(grossUSD)
                            : "$0.00"
                        }
                        className="w-full bg-transparent outline-none text-white text-sm"
                      />

                      <span className="text-sm font-semibold">
                        USD
                      </span>

                    </div>

                  </div>

                </div>

                {/* BREAKDOWN */}
                <div className="bg-[#21242d] rounded-xl p-4 space-y-3 mb-6">

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      Market value
                    </span>

                    <span>
                      {formatUSD(grossUSD)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      Selling fee (1%)
                    </span>

                    <span>
                      -{formatUSD(fee)}
                    </span>
                  </div>

                  <div className="border-t border-gray-700 pt-3 flex justify-between font-semibold">
                    <span>
                      You receive
                    </span>

                    <span>
                      {formatUSD(receiveUSD)}
                    </span>
                  </div>

                </div>

                <p className="text-xs text-gray-500 mb-5">
                  Market price provided by CoinGecko.
                  The final execution price may change.
                </p>

                <div className="flex justify-end">

                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-400 w-40 text-white font-semibold text-sm px-8 py-2.5 rounded-full"
                  >
                    Continue
                  </button>

                </div>

              </form>

            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-800/50">

              <h2 className="text-2xl font-bold mb-4">
                Confirm Sale
              </h2>

              <div className="space-y-4">

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Selling
                  </span>

                  <span>
                    {amount} {selectedCoin.symbol}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Market value
                  </span>

                  <span>
                    {formatUSD(grossUSD)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Fee
                  </span>

                  <span>
                    -{formatUSD(fee)}
                  </span>
                </div>

                <div className="border-t border-gray-700 pt-4 flex justify-between font-bold">
                  <span>
                    You receive
                  </span>

                  <span>
                    {formatUSD(receiveUSD)}
                  </span>
                </div>

              </div>

              <div className="flex justify-between mt-8">

                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2.5 rounded-full border border-gray-700"
                >
                  Back
                </button>

                <button
                  onClick={() => setStep(3)}
                  className="bg-blue-500 px-8 py-2.5 rounded-full"
                >
                  Continue
                </button>

              </div>

            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-800/50">

              <h2 className="text-2xl font-bold mb-4">
                Payment Details
              </h2>

              <p className="text-gray-400 text-sm mb-6">
                Choose where you want to receive your
                funds.
              </p>

              <div className="bg-[#21242d] p-5 rounded-xl">

                <p className="text-sm text-gray-400">
                  Amount to receive
                </p>

                <p className="text-2xl font-bold mt-2">
                  {formatUSD(receiveUSD)}
                </p>

              </div>

              <div className="flex justify-between mt-8">

                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 rounded-full border border-gray-700"
                >
                  Back
                </button>

                <button
                  onClick={() =>
                    alert(
                      "Sell order will be connected to the backend."
                    )
                  }
                  className="bg-blue-500 px-8 py-2.5 rounded-full"
                >
                  Confirm Sale
                </button>

              </div>

            </div>
          )}

        </div>
      </div>

      <CreateAnAccoutSection />

    </div>
  );
};

export default SellCrypto;