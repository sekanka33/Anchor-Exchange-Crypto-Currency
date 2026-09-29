import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../Components/PageHeader";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";

const FAQS = [
  {
    question: "What is Anchor Exchange?",
    answer:
      "Anchor Exchange is a cryptocurrency exchange where you can buy, sell, deposit, and withdraw digital assets, track live market prices, and manage your portfolio in one place.",
  },
  {
    question: "How do I get started with Anchor Exchange?",
    answer:
      "Create an account, verify your email, then head to Buy Crypto to make your first purchase or Deposit to fund your wallet with fiat or crypto.",
    link: { to: "/signup", label: "Create an account" },
  },
  {
    question: "What cryptocurrencies can I buy and sell?",
    answer:
      "Anchor Exchange supports major assets including Bitcoin, Ethereum, BNB, Solana, and Tether, with more added over time.",
  },
  {
    question: "How do I buy and sell on Anchor Exchange?",
    answer:
      "Use the Buy Crypto and Sell Crypto pages to convert between USD and crypto in a few guided steps — select an amount, review the details, then confirm.",
    link: { to: "/buy-crypto", label: "Go to Buy Crypto" },
  },
  {
    question: "How long do deposits and withdrawals take?",
    answer:
      "Fiat and crypto deposits are typically confirmed within seconds in this demo environment. Withdrawals require confirming a link sent to your email before funds are released.",
  },
  {
    question: "Is my account secure?",
    answer:
      "Withdrawals require email confirmation before any funds move, and suspicious activity is flagged through account notifications. We recommend using a strong, unique password.",
  },
];

const FAQItem = ({ faq, isOpen, onToggle }) => (
  <div className="border-b border-gray-200 dark:border-line-color">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="w-full flex items-center justify-between gap-4 py-5 text-left"
    >
      <span className="font-semibold text-slate-900 dark:text-white">{faq.question}</span>
      <span
        className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        aria-hidden="true"
      >
        ▼
      </span>
    </button>

    {isOpen && (
      <div className="pb-5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        <p>{faq.answer}</p>
        {faq.link && (
          <Link to={faq.link.to} className="inline-block mt-2 text-blue-600 dark:text-blue-400 hover:underline">
            {faq.link.label} →
          </Link>
        )}
      </div>
    )}
  </div>
);

const HelpCenter = () => {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div>
      <PageHeader title="FAQ" crumbs={[{ label: "Home", to: "/" }, { label: "Help Center" }]} />

      <div className="flex flex-col items-center px-4 py-14 md:py-20">
        <h1 className="text-3xl md:text-4xl font-bold text-center">Frequently Asked Questions</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-3 text-center">Learn how to get started with Anchor Exchange</p>

        <div className="w-full max-w-2xl mt-10">
          {FAQS.map((faq, index) => (
            <FAQItem
              key={faq.question}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
            />
          ))}
        </div>
      </div>

      <CreateAnAccoutSection />
    </div>
  );
};

export default HelpCenter;
