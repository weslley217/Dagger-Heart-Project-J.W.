import { PlayerDashboard } from "@/components/player-dashboard";
import { getPlayerDashboard } from "@/data/dashboard";
import { requireSession } from "@/lib/auth";

export default async function PlayerPage() {
  const session = await requireSession("PLAYER");
  const data = await getPlayerDashboard(session.userId);

  return (
    <PlayerDashboard
      characters={data.characters}
      cards={data.cards}
      campaigns={data.campaigns}
    />
  );
}
