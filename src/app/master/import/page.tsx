import { CardImporter } from "@/components/card-importer";
import { getImportDashboard } from "@/data/dashboard";
import { requireSession } from "@/lib/auth";

export default async function ImportPage() {
  await requireSession("MASTER");
  const data = await getImportDashboard();

  return <CardImporter count={data.count} cards={data.cards} />;
}
