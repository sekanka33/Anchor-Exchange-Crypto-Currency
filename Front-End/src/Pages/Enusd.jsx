import PageHeader from "../Components/PageHeader";
import EmptyState from "../Components/EmptyState";

const Enusd = () => {
  return (
    <div>
      <PageHeader title="Language & Currency" crumbs={[{ label: "Home", to: "/" }, { label: "EN/USD" }]} />
      <div className="max-w-2xl mx-auto px-4 py-14">
        <EmptyState
          icon="🌐"
          title="Language & Currency"
          description="Language and display-currency selection isn't available yet — change your display currency from Profile & Settings."
        />
      </div>
    </div>
  );
};

export default Enusd;
