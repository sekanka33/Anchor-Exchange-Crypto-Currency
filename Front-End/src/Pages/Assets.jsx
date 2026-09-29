import PageHeader from "../Components/PageHeader";
import EmptyState from "../Components/EmptyState";

const Assets = () => {
  return (
    <div>
      <PageHeader title="Assets" crumbs={[{ label: "Home", to: "/" }, { label: "Assets" }]} />
      <div className="max-w-2xl mx-auto px-4 py-14">
        <EmptyState
          icon="📂"
          title="Assets"
          description="This section is still being built out. Check the Wallet page for your current asset balances."
        />
      </div>
    </div>
  );
};

export default Assets;
