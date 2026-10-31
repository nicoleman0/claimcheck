import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states";

export default function Home() {
  return (
    <>
      <PageHeader title="Overview" description="Replace this page with the app's first screen." />
      <EmptyState title="Nothing here yet" description="Records you add will appear here." />
    </>
  );
}
