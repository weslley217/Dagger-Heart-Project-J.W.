import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { MasterSessionView } from "@/components/master-session-view";

type Props = { params: Promise<{ id: string }> };

export default async function MasterSessionPage({ params }: Props) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") redirect("/login");

  const { id: campaignId } = await params;

  const [campaignRes, npcsRes, turnsRes, charactersRes] = await Promise.all([
    db.from("campaigns").select("*").eq("id", campaignId).single(),
    db.from("campaign_npcs").select("*").eq("campaign_id", campaignId).order("created_at"),
    db.from("campaign_turns").select("*").eq("campaign_id", campaignId).order("position"),
    db
      .from("campaign_characters")
      .select("id, name, level, class_key, current_hp, total_hp, armor_current, armor_max, threshold1, threshold2, evasion, conditions, resources, is_downed, player_id")
      .eq("campaign_id", campaignId)
      .eq("status", "active"),
  ]);

  if (campaignRes.error || !campaignRes.data) redirect("/master");

  const campaign = campaignRes.data as Record<string, unknown>;
  const npcs = (npcsRes.data ?? []) as Record<string, unknown>[];
  const turns = (turnsRes.data ?? []) as Record<string, unknown>[];
  const characters = (charactersRes.data ?? []) as Record<string, unknown>[];

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">Sessão ao vivo</p>
            <h1 className="text-xl font-bold text-white">{String(campaign.name)}</h1>
          </div>
          <Link href="/master" className="rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">
            ← Dashboard
          </Link>
        </div>

        <MasterSessionView
          campaignId={campaignId}
          campaignRaw={campaign}
          npcsRaw={npcs}
          turnsRaw={turns}
          charactersRaw={characters}
        />
      </div>
    </div>
  );
}
