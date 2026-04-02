import { MasterDashboard } from "@/components/master-dashboard";
import { getMasterDashboard } from "@/data/dashboard";
import { requireSession } from "@/lib/auth";

export default async function MasterPage() {
  const session = await requireSession("MASTER");
  const data = await getMasterDashboard(session.userId);

  return (
    <MasterDashboard
      characters={data.characters}
      cards={data.cards}
      campaigns={data.campaigns}
      users={data.users}
      usersByCampaign={data.usersByCampaign}
    />
  );
}
