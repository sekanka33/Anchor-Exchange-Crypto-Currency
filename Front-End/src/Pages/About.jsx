import { Link } from "react-router-dom";
import PageHeader from "../Components/PageHeader";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import { PAIRS } from "../api/tradingPairs";

// Only describes what the app actually does today (see the linked pages).
const FEATURES = [
  {
    title: "Buy and sell crypto",
    body: "Convert between fiat and crypto in a few guided steps at the live market price, with a 1% fee.",
    to: "/buy-crypto",
    cta: "Buy Crypto",
  },
  {
    title: "Spot trading",
    body: "Trade on the Exchange with a live chart, order book, and recent trades streamed from market data providers.",
    to: "/exchange",
    cta: "Open Exchange",
  },
  {
    title: "Live markets",
    body: "Follow prices, 24-hour changes, and market caps across the cryptocurrency market.",
    to: "/markets",
    cta: "View Markets",
  },
  {
    title: "Deposits and withdrawals",
    body: "Fund your wallet by bank transfer, card, or crypto, and withdraw to your bank or an external wallet.",
    to: "/wallet",
    cta: "Go to Wallet",
  },
];

const SECURITY = [
  "New accounts verify their email address before signing in.",
  "Every withdrawal must be confirmed from a link emailed to the account holder before funds move.",
  "You can sign in on a computer by scanning its QR code with a phone that is already signed in, instead of typing your password.",
  "Account activity, such as deposits and withdrawals, appears in your notifications.",
];

const About = () => {
  return (
    <div>
      <PageHeader title="About Anchor Exchange" crumbs={[{ label: "Home", to: "/" }, { label: "About" }]} />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-14 md:py-20 text-slate-900 dark:text-white">
        <section className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold">Crypto, without the guesswork</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
            Anchor Exchange is a cryptocurrency exchange where you can buy, sell, and trade digital assets,
            track live market prices, and manage your wallet in one place.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="about-features">
          <h2 id="about-features" className="text-xl font-bold mb-6">What you can do</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-3 p-6 rounded-2xl border border-gray-200 dark:border-line-color bg-white dark:bg-crypto-color">
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">{f.body}</p>
                <Link to={f.to} className="self-start text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  {f.cta} →
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="about-assets">
          <h2 id="about-assets" className="text-xl font-bold mb-4">Supported assets</h2>
          <ul className="flex flex-wrap gap-2">
            {[...PAIRS.map((p) => `${p.name} (${p.asset})`), "Tether (USDT)"].map((label) => (
              <li key={label} className="px-3 py-1.5 rounded-full text-sm bg-slate-100 dark:bg-input-field">{label}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="about-security">
          <h2 id="about-security" className="text-xl font-bold mb-4">Keeping your account safe</h2>
          <ul className="flex flex-col gap-3 list-disc pl-5 text-gray-600 dark:text-gray-400">
            {SECURITY.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
            Questions about fees or limits? See the <Link to="/faq" className="text-blue-600 dark:text-blue-400 underline">Help Center</Link>.
          </p>
        </section>
      </div>

      <CreateAnAccoutSection />
    </div>
  );
};

export default About;
