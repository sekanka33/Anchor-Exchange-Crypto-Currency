import { Link } from "react-router-dom";
import PageHeader from "../Components/PageHeader";
import EmptyState from "../Components/EmptyState";
import { PAIRS } from "../api/tradingPairs";

const Bitusdt = () => {
  return (
    <div>
      <PageHeader title="BIT/USDT" crumbs={[{ label: "Home", to: "/" }, { label: "BIT/USDT" }]} />
      <div className="max-w-2xl mx-auto px-4 py-14 flex flex-col items-center gap-6">
        <EmptyState
          icon="₿"
          title="BIT/USDT isn't listed"
          description={`Anchor Exchange doesn't support the BIT token. You can trade ${PAIRS.map((p) => p.asset).join(", ")} against USDT on the Exchange.`}
        />
        <Link to="/exchange" className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-5 rounded-full flex items-center text-sm font-medium">
          Open Exchange
        </Link>
      </div>
    </div>
  );
};

export default Bitusdt;
