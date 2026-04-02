"use client";

import { useEffect, useEffectEvent } from "react";
import { useRouter } from "next/navigation";

import { getBrowserSupabase } from "@/lib/supabase-browser";

const CHANNEL = "dh-live-sync";
const REALTIME_TABLES = [
  "campaigns",
  "campaign_members",
  "characters",
  "campaign_characters",
  "character_cards",
  "campaign_character_cards",
  "damage_logs",
  "effect_logs",
] as const;

export function emitLiveRefresh(reason: string) {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return;
  }

  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ reason, timestamp: Date.now() });
  channel.close();
}

export function useLiveRefresh(intervalMs = 5000) {
  const router = useRouter();
  const refresh = useEffectEvent(() => {
    router.refresh();
  });

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
    const interval = window.setInterval(() => refresh(), intervalMs);
    const realtimeChannel = supabase?.channel(`${CHANNEL}-realtime`);

    if (channel) {
      channel.addEventListener("message", refresh as EventListener);
    }

    REALTIME_TABLES.forEach((table) => {
      realtimeChannel?.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        () => refresh(),
      );
    });

    realtimeChannel?.subscribe();

    return () => {
      window.clearInterval(interval);
      channel?.close();
      if (supabase && realtimeChannel) {
        void supabase.removeChannel(realtimeChannel);
      }
    };
  }, [intervalMs]);
}
