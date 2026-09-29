import PageHeader from "../Components/PageHeader";
import EmptyState from "../Components/EmptyState";

const Bitusdt = () => {
  return (
    <div>
      <PageHeader title="BIT/USDT" crumbs={[{ label: "Home", to: "/" }, { label: "BIT/USDT" }]} />
      <div className="max-w-2xl mx-auto px-4 py-14">
        <EmptyState
          icon="₿"
          title="BIT/USDT"
          description="A dedicated BIT/USDT market view isn't available yet — trade this pair from the Exchange page instead."
        />
      </div>
    </div>
  );
};

export default Bitusdt;
