"use client";

import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { emitLiveRefresh } from "@/hooks/use-live-refresh";
import { categoryLabels } from "@/lib/reference-data";
import { useUiStore } from "@/stores/ui-store";
import type { CardSummary } from "@/types/domain";

type CardImporterProps = {
  count: number;
  cards: CardSummary[];
};

export function CardImporter({ count, cards }: CardImporterProps) {
  const { importTab, setImportTab } = useUiStore();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitForm(url: string, formData: FormData) {
    setError(null);
    setMessage(null);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setError(data.error ?? "Falha na importação.");
      return;
    }

    emitLiveRefresh(url);
    setMessage(data.message ?? "Importação concluída.");
  }

  return (
    <AppShell
      role="MASTER"
      title="Admin e Importador"
      subtitle="Faça ingestão por PDF, JSON ou cadastro manual assistido e mantenha as cartas estruturadas para o motor de efeitos."
    >
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SurfaceCard>
          <p className="text-xs uppercase tracking-[0.28em] text-white/45">Banco de cartas</p>
          <h2 className="mt-2 text-4xl font-semibold text-white">{count}</h2>
          <p className="mt-3 text-sm leading-7 text-white/60">
            Use o PDF `DH-Baralho.pdf` para importar várias cartas de uma vez. Se algum efeito não
            puder ser inferido automaticamente, complete manualmente ou por JSON.
          </p>
        </SurfaceCard>
        <SurfaceCard className="flex flex-wrap gap-3">
          {[
            ["pdf", "Importar PDF"],
            ["json", "Importar JSON"],
            ["manual", "Cadastro manual"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                importTab === key
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-white/6 text-white/65"
              }`}
              onClick={() => setImportTab(key as "pdf" | "json" | "manual")}
            >
              {label}
            </button>
          ))}
        </SurfaceCard>
      </section>

      {importTab === "pdf" ? (
        <SurfaceCard>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitForm("/api/cards/import/pdf", new FormData(event.currentTarget));
            }}
          >
            <h3 className="text-xl font-semibold text-white">Upload do PDF de cartas</h3>
            <input
              type="file"
              name="file"
              accept="application/pdf"
              className="field py-3"
              required
            />
            <Button type="submit">Importar PDF</Button>
          </form>
        </SurfaceCard>
      ) : null}

      {importTab === "json" ? (
        <SurfaceCard>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitForm("/api/cards/import/json", new FormData(event.currentTarget));
            }}
          >
            <h3 className="text-xl font-semibold text-white">Upload de JSON</h3>
            <input type="file" name="file" accept="application/json" className="field py-3" />
            <textarea
              name="json"
              className="field min-h-44 resize-y py-3"
              placeholder='Cole um array JSON de cartas ou um objeto com { "cards": [...] }.'
            />
            <Button type="submit">Importar JSON</Button>
          </form>
        </SurfaceCard>
      ) : null}

      {importTab === "manual" ? (
        <SurfaceCard>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitForm("/api/cards/import/manual", new FormData(event.currentTarget));
            }}
          >
            <label className="space-y-2">
              <span className="text-sm text-white/70">ID</span>
              <input name="id" className="field" placeholder="DH Básico 001/270" required />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white/70">Nome</span>
              <input name="name" className="field" placeholder="Trovador" required />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white/70">Categoria</span>
              <select name="category" className="field" defaultValue="outros">
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white/70">Tier</span>
              <input name="tier" className="field" placeholder="Fundamental" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white/70">Classe</span>
              <input name="classKey" className="field" placeholder="bardo" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white/70">Subclasse</span>
              <input name="subclassKey" className="field" placeholder="trovador" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white/70">Domínio</span>
              <input name="domainKey" className="field" placeholder="codice" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white/70">Keywords (csv)</span>
              <input name="keywords" className="field" placeholder="Esperança, cura" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm text-white/70">Texto bruto</span>
              <textarea name="text" className="field min-h-44 resize-y py-3" required />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm text-white/70">Effects JSON (opcional)</span>
              <textarea
                name="effectsJson"
                className="field min-h-36 resize-y py-3"
                placeholder='[{"type":"heal_hp","amount":2}]'
              />
            </label>
            <div className="md:col-span-2">
              <Button type="submit">Salvar carta manualmente</Button>
            </div>
          </form>
        </SurfaceCard>
      ) : null}

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <SurfaceCard>
        <h3 className="text-lg font-semibold text-white">Últimas cartas importadas</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className="rounded-[24px] border border-white/8 bg-black/18 p-4"
            >
              <p className="text-sm font-semibold text-white">{card.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/40">
                {categoryLabels[card.category]} {card.tier ? `· ${card.tier}` : ""}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/60">
                {card.text.slice(0, 140)}...
              </p>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </AppShell>
  );
}
