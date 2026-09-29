import PageHeader from "../Components/PageHeader";
import EmptyState from "../Components/EmptyState";

const Pages = () => {
  return (
    <div>
      <PageHeader title="Pages" crumbs={[{ label: "Home", to: "/" }, { label: "Pages" }]} />
      <div className="max-w-2xl mx-auto px-4 py-14">
        <EmptyState
          icon="📄"
          title="Pages"
          description="This section is still being built out. Check back later."
        />
      </div>
    </div>
  );
};

export default Pages;
