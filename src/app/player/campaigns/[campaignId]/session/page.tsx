import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PlayerSessionView } from "@/components/player-session-view";

type Props = { params: Promise<{ campaignId: string }> };

export default async function PlayerSessionPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { campaignId } = await params;

  const [campaignRes, charsRes, npcsRes, turnsRes] = await Promise.all([
    db.from("campaigns").select("id, name, session_active, map_tokens, map_shapes").eq("id", campaignId).single(),
    db
      .from("campaign_characters")
      .select("id, name, level, class_key, current_hp, total_hp, armor_current, armor_max, threshold1, threshold2, evasion, conditions, resources, is_downed, equipment, campaign_character_cards(id, card_id, status, uses_max, uses_current, cards(id, name, text, category, effects, source_pdf_key, source_page))")
      .eq("campaign_id", campaignId)
      .eq("player_id", session.userId)
      .eq("status", "active"),
    db
      .from("campaign_npcs")
      .select("id, name, npc_type, health_indicator, visible_to_players, conditions, token_color, token_x, token_y")
      .eq("campaign_id", campaignId)
      .eq("visible_to_players", true),
    db
      .from("campaign_turns")
      .select("id, entity_type, entity_id, entity_name, initiative, position, is_active")
      .eq("campaign_id", campaignId)
      .order("position"),
  ]);

  if (campaignRes.error || !campaignRes.data) redirect("/player");

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">Sessão ao vivo</p>
            <h1 className="text-xl font-bold text-white">{String(campaignRes.data.name)}</h1>
          </div>
          <Link
            href={`/player/campaigns/${campaignId}`}
            className="rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            ← Campanha
          </Link>
        </div>

        <PlayerSessionView
          campaignId={campaignId}
          campaignRaw={campaignRes.data as Record<string, unknown>}
          charactersRaw={(charsRes.data ?? []) as Record<string, unknown>[]}
          npcsRaw={(npcsRes.data ?? []) as Record<string, unknown>[]}
          turnsRaw={(turnsRes.data ?? []) as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
