"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEFAULT_PAIR, PAIR_GROUPS } from "@/lib/pair-groups";

type LiveTrade = {
  id: string;
  trade_date: string;
  pair: string;
  side: "long" | "short";
  status: "limit" | "running" | "closed";
  outcome: "tp" | "sl" | "be" | null;
  r_value: number | null;
  chart_url: string | null;
  notes: string | null;
  is_validated: boolean;
  validation_notes: string | null;
  validated_at: string | null;
  created_at: string;
};

const now = new Date();
const initialDate = now.toISOString().slice(0, 10);

function statusClass(status: LiveTrade["status"]) {
  if (status === "closed") {
    return "border-emerald-500/50 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "running") {
    return "border-sky-500/50 bg-sky-500/10 text-sky-300";
  }
  return "border-amber-500/50 bg-amber-500/10 text-amber-300";
}

export default function LivePage() {
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [tradeDate, setTradeDate] = useState(initialDate);
  const [pair, setPair] = useState(DEFAULT_PAIR);
  const [side, setSide] = useState<"long" | "short">("long");
  const [status, setStatus] = useState<"limit" | "running" | "closed">("limit");
  const [outcome, setOutcome] = useState<"tp" | "sl" | "be" | "">("");
  const [rValue, setRValue] = useState("");
  const [chartUrl, setChartUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isValidated, setIsValidated] = useState(false);
  const [validationNotes, setValidationNotes] = useState("");
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);

  const [editKeyInput, setEditKeyInput] = useState("");
  const [editKey, setEditKey] = useState("");
  const [isEditAuthorized, setIsEditAuthorized] = useState(false);
  const [showEditorPanel, setShowEditorPanel] = useState(false);

  const activeEditKey = editKeyInput.trim() || editKey.trim();
  const canEdit = isEditAuthorized && activeEditKey.length > 0;

  async function verifyEditAccess(key: string) {
    const trimmed = key.trim();
    if (!trimmed) {
      setIsEditAuthorized(false);
      return;
    }

    const response = await fetch("/api/edit-access", {
      method: "POST",
      headers: {
        "x-edit-key": trimmed,
      },
    });

    if (response.ok) {
      setIsEditAuthorized(true);
      return;
    }

    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setIsEditAuthorized(false);
    throw new Error(result?.error ?? "Invalid edit key.");
  }

  function buildRequestHeaders(withJsonContentType: boolean) {
    const headers = new Headers();

    if (withJsonContentType) {
      headers.set("Content-Type", "application/json");
    }

    if (canEdit) {
      headers.set("x-edit-key", activeEditKey);
    }

    return headers;
  }

  async function loadTrades() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/live-trades", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load live trades.");
      }
      setTrades(result.trades as LiveTrade[]);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingTradeId(null);
    setTradeDate(initialDate);
    setPair(DEFAULT_PAIR);
    setSide("long");
    setStatus("limit");
    setOutcome("");
    setRValue("");
    setChartUrl("");
    setNotes("");
    setIsValidated(false);
    setValidationNotes("");
  }

  useEffect(() => {
    const savedEditKey = (window.localStorage.getItem("edit-access-key") ?? "").trim();
    setEditKey(savedEditKey);
    setEditKeyInput(savedEditKey);

    if (!savedEditKey) {
      return;
    }

    void verifyEditAccess(savedEditKey).catch(() => {
      setIsEditAuthorized(false);
    });
  }, []);

  useEffect(() => {
    void loadTrades();
  }, []);

  useEffect(() => {
    function handleToggleEditorPanel(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "e";
      if (!isShortcut) {
        return;
      }

      event.preventDefault();
      setShowEditorPanel((current) => !current);
    }

    window.addEventListener("keydown", handleToggleEditorPanel);
    return () => {
      window.removeEventListener("keydown", handleToggleEditorPanel);
    };
  }, []);

  async function saveLiveTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!canEdit) {
      setError("Read-only mode is enabled.");
      return;
    }

    if (status === "closed" && !outcome) {
      setError("Closed trades require an outcome (tp/sl/be).");
      return;
    }

    if (status !== "closed" && outcome) {
      setError("Outcome can only be set when status is closed.");
      return;
    }

    const parsedR = rValue.trim() === "" ? null : Number(rValue);
    if (parsedR != null && Number.isNaN(parsedR)) {
      setError("R value must be numeric.");
      return;
    }

    try {
      const method = editingTradeId ? "PATCH" : "POST";
      const response = await fetch("/api/live-trades", {
        method,
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          id: editingTradeId ?? undefined,
          tradeDate,
          pair,
          side,
          status,
          outcome: status === "closed" ? outcome : null,
          rValue: parsedR,
          chartUrl,
          notes,
          isValidated,
          validationNotes,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          setIsEditAuthorized(false);
        }
        throw new Error(result.error ?? "Unable to save live trade.");
      }

      resetForm();
      await loadTrades();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unknown error";
      setError(message);
    }
  }

  function startEditingTrade(trade: LiveTrade) {
    setEditingTradeId(trade.id);
    setTradeDate(trade.trade_date);
    setPair(trade.pair);
    setSide(trade.side);
    setStatus(trade.status);
    setOutcome(trade.outcome ?? "");
    setRValue(trade.r_value == null ? "" : String(trade.r_value));
    setChartUrl(trade.chart_url ?? "");
    setNotes(trade.notes ?? "");
    setIsValidated(trade.is_validated);
    setValidationNotes(trade.validation_notes ?? "");
  }

  async function handleDeleteTrade(tradeId: string) {
    if (!canEdit) {
      setError("Read-only mode is enabled.");
      return;
    }

    if (!window.confirm("Delete this live trade?")) {
      return;
    }

    setError("");
    try {
      const response = await fetch(`/api/live-trades?id=${tradeId}`, {
        method: "DELETE",
        headers: buildRequestHeaders(false),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          setIsEditAuthorized(false);
        }
        throw new Error(result.error ?? "Unable to delete live trade.");
      }

      if (editingTradeId === tradeId) {
        resetForm();
      }

      await loadTrades();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unknown error";
      setError(message);
    }
  }

  async function handleValidateTrade(trade: LiveTrade) {
    if (!canEdit) {
      setError("Read-only mode is enabled.");
      return;
    }

    setError("");
    try {
      const response = await fetch("/api/live-trades", {
        method: "PATCH",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          id: trade.id,
          tradeDate: trade.trade_date,
          pair: trade.pair,
          side: trade.side,
          status: trade.status,
          outcome: trade.outcome,
          rValue: trade.r_value,
          chartUrl: trade.chart_url,
          notes: trade.notes,
          isValidated: true,
          validationNotes: trade.validation_notes ?? "Validated from live journal",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          setIsEditAuthorized(false);
        }
        throw new Error(result.error ?? "Unable to validate live trade.");
      }

      await loadTrades();
    } catch (validateError) {
      const message = validateError instanceof Error ? validateError.message : "Unknown error";
      setError(message);
    }
  }

  const tradesByRecency = useMemo(() => {
    return [...trades].sort((a, b) => {
      const dateCompare = b.trade_date.localeCompare(a.trade_date);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [trades]);

  const liveSummary = useMemo(() => {
    const total = trades.length;
    const limitCount = trades.filter((trade) => trade.status === "limit").length;
    const runningCount = trades.filter((trade) => trade.status === "running").length;
    const closed = trades.filter((trade) => trade.status === "closed");
    const closedCount = closed.length;
    const wins = closed.filter((trade) => trade.outcome === "tp").length;
    const losses = closed.filter((trade) => trade.outcome === "sl").length;
    const beCount = closed.filter((trade) => trade.outcome === "be").length;
    const validatedCount = trades.filter((trade) => trade.is_validated).length;
    const netR = closed.reduce((sum, trade) => sum + Number(trade.r_value ?? 0), 0);
    const winRate = closedCount > 0 ? (wins / closedCount) * 100 : 0;
    const validationRate = total > 0 ? (validatedCount / total) * 100 : 0;

    return {
      total,
      limitCount,
      runningCount,
      closedCount,
      wins,
      losses,
      beCount,
      validatedCount,
      netR,
      winRate,
      validationRate,
    };
  }, [trades]);

  return (
    <main className="min-h-screen bg-background px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-2xl border border-foreground/20 bg-foreground/5 p-4 sm:p-5">
          <h1 className="text-2xl font-semibold">Live Trading Journal</h1>
          <p className="mt-1 text-sm text-foreground/75">Track active market trades with statuses, validation, and outcomes.</p>

          {showEditorPanel && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-foreground/20 bg-background/60 p-3 sm:flex-row sm:items-center">
              <p className="text-xs uppercase tracking-wide text-foreground/70">Editor Access</p>
              <input
                type="password"
                value={editKeyInput}
                onChange={(event) => {
                  setEditKeyInput(event.target.value);
                  setEditKey(event.target.value);
                  setIsEditAuthorized(false);
                }}
                className="min-w-0 flex-1 rounded-lg border border-foreground/25 bg-background px-3 py-2 text-sm"
                placeholder="Enter edit key"
              />
              <button
                type="button"
                onClick={() => {
                  const nextKey = editKeyInput.trim();
                  setEditKey(nextKey);
                  window.localStorage.setItem("edit-access-key", nextKey);
                  void verifyEditAccess(nextKey).catch((unlockError) => {
                    const message = unlockError instanceof Error ? unlockError.message : "Invalid edit key.";
                    setError(message);
                  });
                }}
                className="rounded-lg border border-foreground/30 px-3 py-2 text-sm font-medium"
              >
                Unlock
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditKey("");
                  setEditKeyInput("");
                  setIsEditAuthorized(false);
                  window.localStorage.removeItem("edit-access-key");
                }}
                className="rounded-lg border border-foreground/30 px-3 py-2 text-sm font-medium"
              >
                Lock
              </button>
              <span className="text-xs text-foreground/70">{canEdit ? "Edit mode enabled" : "Read-only mode"}</span>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-foreground/30 bg-background px-3 py-2 text-sm text-foreground">
              {error}
            </p>
          )}

          <form onSubmit={saveLiveTrade} className="mt-4 grid gap-3 rounded-xl border border-foreground/20 bg-background p-4">
            <fieldset disabled={!canEdit} className="grid gap-3 disabled:cursor-not-allowed disabled:opacity-70">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1 text-sm">
                Date
                <input
                  type="date"
                  value={tradeDate}
                  onChange={(event) => setTradeDate(event.target.value)}
                  className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Pair
                <select
                  value={pair}
                  onChange={(event) => setPair(event.target.value)}
                  className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                >
                  {PAIR_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                Side
                <select
                  value={side}
                  onChange={(event) => setSide(event.target.value as "long" | "short")}
                  className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                Status
                <select
                  value={status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as "limit" | "running" | "closed";
                    setStatus(nextStatus);
                    if (nextStatus !== "closed") {
                      setOutcome("");
                    }
                  }}
                  className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                >
                  <option value="limit">Limit</option>
                  <option value="running">Running</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-1 text-sm">
                Outcome
                <select
                  value={outcome}
                  disabled={status !== "closed"}
                  onChange={(event) => setOutcome(event.target.value as "tp" | "sl" | "be" | "")}
                  className="rounded-lg border border-foreground/20 bg-background px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">-</option>
                  <option value="tp">TP</option>
                  <option value="sl">SL</option>
                  <option value="be">BE</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                R Multiple
                <input
                  type="number"
                  step="0.1"
                  value={rValue}
                  onChange={(event) => setRValue(event.target.value)}
                  className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                  placeholder="Optional"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Chart URL
                <input
                  type="url"
                  value={chartUrl}
                  onChange={(event) => setChartUrl(event.target.value)}
                  className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                  placeholder="https://..."
                />
              </label>

              <label className="grid gap-1 text-sm">
                Validation Notes
                <input
                  type="text"
                  value={validationNotes}
                  onChange={(event) => setValidationNotes(event.target.value)}
                  className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                  placeholder="First validation notes"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-20 rounded-lg border border-foreground/20 bg-background px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isValidated}
                onChange={(event) => setIsValidated(event.target.checked)}
                className="h-4 w-4"
              />
              First validation completed
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!canEdit}
                className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
              >
                {editingTradeId ? "Update Live Trade" : "Add Live Trade"}
              </button>
              {editingTradeId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full rounded-lg border border-foreground/30 px-4 py-2 text-sm font-medium sm:w-fit"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            </fieldset>
          </form>
        </section>

        <section className="rounded-2xl border border-foreground/20 bg-foreground/5 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Live Trades Log</h2>
          {loading && <p className="mt-3 text-sm text-foreground/70">Loading...</p>}

          <div className="mt-4 grid gap-3 md:hidden">
            {tradesByRecency.map((trade) => (
              <article key={trade.id} className="rounded-lg border border-foreground/20 bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold uppercase ${statusClass(trade.status)}`}>
                    {trade.status}
                  </span>
                  {trade.is_validated && <span className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-300">Validated</span>}
                </div>
                <p className="mt-2 font-medium">{trade.pair} · {trade.side.toUpperCase()}</p>
                <p className="text-xs text-foreground/70">{trade.trade_date}</p>
                <p className="mt-1 text-xs uppercase text-foreground/70">Outcome: {trade.outcome ? trade.outcome.toUpperCase() : "-"}</p>
                <p className="text-xs uppercase text-foreground/70">R: {trade.r_value == null ? "-" : trade.r_value.toFixed(2)}</p>
                {trade.chart_url && (
                  <a href={trade.chart_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">
                    Open Chart
                  </a>
                )}
                <p className="mt-2 text-foreground/80">{trade.notes || "-"}</p>
                {trade.validation_notes && <p className="mt-1 text-xs text-foreground/70">Validation: {trade.validation_notes}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEditingTrade(trade)}
                    disabled={!canEdit}
                    className="rounded-md border border-foreground/30 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Edit
                  </button>
                  {!trade.is_validated && (
                    <button
                      type="button"
                      onClick={() => void handleValidateTrade(trade)}
                      disabled={!canEdit}
                      className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Validate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteTrade(trade.id)}
                    disabled={!canEdit}
                    className="rounded-md border border-foreground/30 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {tradesByRecency.length === 0 && (
              <div className="rounded-lg border border-foreground/20 bg-background px-3 py-6 text-center text-sm text-foreground/70">
                No live trades yet.
              </div>
            )}
          </div>

          <div className="mt-4 hidden overflow-x-auto rounded-lg border border-foreground/20 bg-background md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-foreground/20 text-left text-xs uppercase tracking-wide text-foreground/70">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Pair</th>
                  <th className="px-3 py-3 font-medium">Side</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Outcome</th>
                  <th className="px-3 py-3 font-medium">R</th>
                  <th className="px-3 py-3 font-medium">Chart</th>
                  <th className="px-3 py-3 font-medium">Validated</th>
                  <th className="px-3 py-3 font-medium">Notes</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tradesByRecency.map((trade) => (
                  <tr key={trade.id} className="border-b border-foreground/10 align-top">
                    <td className="px-3 py-3">{trade.trade_date}</td>
                    <td className="px-3 py-3 font-medium uppercase">{trade.pair}</td>
                    <td className="px-3 py-3 uppercase">{trade.side}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold uppercase ${statusClass(trade.status)}`}>
                        {trade.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 uppercase">{trade.outcome ?? "-"}</td>
                    <td className="px-3 py-3">{trade.r_value == null ? "-" : trade.r_value.toFixed(2)}</td>
                    <td className="px-3 py-3">
                      {trade.chart_url ? (
                        <a href={trade.chart_url} target="_blank" rel="noreferrer" className="underline">
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {trade.is_validated ? (
                        <span className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-300">Yes</span>
                      ) : (
                        <span className="text-foreground/70">No</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-foreground/80">
                      <p>{trade.notes || "-"}</p>
                      {trade.validation_notes && <p className="mt-1 text-xs text-foreground/70">Validation: {trade.validation_notes}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingTrade(trade)}
                          disabled={!canEdit}
                          className="rounded-md border border-foreground/30 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit
                        </button>
                        {!trade.is_validated && (
                          <button
                            type="button"
                            onClick={() => void handleValidateTrade(trade)}
                            disabled={!canEdit}
                            className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Validate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteTrade(trade.id)}
                          disabled={!canEdit}
                          className="rounded-md border border-foreground/30 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tradesByRecency.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-foreground/70">
                      No live trades yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-foreground/20 bg-foreground/5 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Live Account Summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-foreground/20 bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">Total Live Trades</p>
              <p className="mt-1 text-xl font-semibold">{liveSummary.total}</p>
            </div>
            <div className="rounded-lg border border-foreground/20 bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">Active (Limit + Running)</p>
              <p className="mt-1 text-xl font-semibold">{liveSummary.limitCount + liveSummary.runningCount}</p>
            </div>
            <div className="rounded-lg border border-foreground/20 bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">Closed Trades</p>
              <p className="mt-1 text-xl font-semibold">{liveSummary.closedCount}</p>
            </div>
            <div className="rounded-lg border border-foreground/20 bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">Net R (Closed)</p>
              <p className="mt-1 text-xl font-semibold">{`${liveSummary.netR >= 0 ? "+" : ""}${liveSummary.netR.toFixed(2)}R`}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg border border-foreground/20 bg-background p-3 text-sm">
              <p className="font-semibold uppercase tracking-wide text-foreground/70">Status Breakdown</p>
              <p className="mt-2">Limit: {liveSummary.limitCount}</p>
              <p>Running: {liveSummary.runningCount}</p>
              <p>Closed: {liveSummary.closedCount}</p>
            </div>
            <div className="rounded-lg border border-foreground/20 bg-background p-3 text-sm">
              <p className="font-semibold uppercase tracking-wide text-foreground/70">Closed Outcomes</p>
              <p className="mt-2">TP: {liveSummary.wins}</p>
              <p>SL: {liveSummary.losses}</p>
              <p>BE: {liveSummary.beCount}</p>
              <p>Win Rate: {liveSummary.winRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-foreground/20 bg-background p-3 text-sm">
              <p className="font-semibold uppercase tracking-wide text-foreground/70">Validation</p>
              <p className="mt-2">Validated: {liveSummary.validatedCount}</p>
              <p>Validation Rate: {liveSummary.validationRate.toFixed(1)}%</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
