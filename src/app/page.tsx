"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEFAULT_PAIR, PAIR_GROUPS } from "@/lib/pair-groups";

type ThemeMode = "dark" | "light";

type Session = {
  id: string;
  pair: string;
  month: number;
  year: number;
  created_at: string;
  totalTrades: number;
  totalR: number;
};

type Trade = {
  id: string;
  session_id: string;
  trade_date: string;
  side: "long" | "short";
  outcome: "win" | "lose" | "be";
  is_warning: boolean;
  warning_reason: string | null;
  r_value: number;
  notes: string | null;
  chart_url: string | null;
  created_at: string;
};

const OUTCOME_DEFAULT_R: Record<Trade["outcome"], string> = {
  win: "3",
  lose: "-1",
  be: "0",
};

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const now = new Date();
const initialDate = now.toISOString().slice(0, 10);

function monthLabel(month: number) {
  return MONTHS.find((item) => item.value === month)?.label ?? `${month}`;
}

function formatR(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [linkedSessionIds, setLinkedSessionIds] = useState<string[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [sessionPair, setSessionPair] = useState(DEFAULT_PAIR);
  const [sessionMonth, setSessionMonth] = useState(now.getMonth() + 1);
  const [sessionYear, setSessionYear] = useState(now.getFullYear());

  const [sessionEditPair, setSessionEditPair] = useState(DEFAULT_PAIR);
  const [sessionEditMonth, setSessionEditMonth] = useState(now.getMonth() + 1);
  const [sessionEditYear, setSessionEditYear] = useState(now.getFullYear());

  const [tradeDate, setTradeDate] = useState(initialDate);
  const [tradeSide, setTradeSide] = useState<"long" | "short">("long");
  const [tradeOutcome, setTradeOutcome] = useState<"win" | "lose" | "be">("win");
  const [tradeIsWarning, setTradeIsWarning] = useState(false);
  const [tradeWarningReason, setTradeWarningReason] = useState("");
  const [tradeRValue, setTradeRValue] = useState(OUTCOME_DEFAULT_R.win);
  const [tradeNotes, setTradeNotes] = useState("");
  const [tradeChartUrl, setTradeChartUrl] = useState("");
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [editKeyInput, setEditKeyInput] = useState("");
  const [editKey, setEditKey] = useState("");
  const [isEditAuthorized, setIsEditAuthorized] = useState(false);
  const [showEditorPanel, setShowEditorPanel] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const savedEditKey = (window.localStorage.getItem("edit-access-key") ?? "").trim();
    setEditKey(savedEditKey);
    setEditKeyInput(savedEditKey);

    const savedTheme = window.localStorage.getItem("theme-mode");
    if (savedTheme === "light" || savedTheme === "dark") {
      setThemeMode(savedTheme);
      return;
    }

    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    setThemeMode(prefersLight ? "light" : "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    window.localStorage.setItem("theme-mode", themeMode);
  }, [themeMode]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [sessions, selectedSessionId],
  );

  const activeTradeSessionIds = useMemo(() => {
    if (linkedSessionIds.length > 0) {
      return sessions.filter((session) => linkedSessionIds.includes(session.id)).map((session) => session.id);
    }
    return selectedSessionId ? [selectedSessionId] : [];
  }, [linkedSessionIds, sessions, selectedSessionId]);

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

  useEffect(() => {
    if (!editKey) {
      return;
    }

    void verifyEditAccess(editKey).catch(() => {
      setIsEditAuthorized(false);
    });
  }, [editKey]);

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

  async function loadSessions() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/sessions", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load sessions.");
      }

      const loadedSessions: Session[] = result.sessions;
      setSessions(loadedSessions);

      if (loadedSessions.length > 0) {
        setSelectedSessionId((current) => {
          if (current && loadedSessions.some((item) => item.id === current)) {
            return current;
          }
          return loadedSessions[0].id;
        });
      } else {
        setSelectedSessionId("");
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrades(sessionIds: string[]) {
    if (sessionIds.length === 0) {
      setTrades([]);
      return;
    }

    setError("");
    try {
      const response = await fetch(`/api/trades?sessionIds=${encodeURIComponent(sessionIds.join(","))}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load trades.");
      }
      setTrades(result.trades);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unknown error";
      setError(message);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    void loadTrades(activeTradeSessionIds);
  }, [activeTradeSessionIds]);

  useEffect(() => {
    setLinkedSessionIds((current) => current.filter((id) => sessions.some((session) => session.id === id)));
  }, [sessions]);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    setSessionEditPair(selectedSession.pair);
    setSessionEditMonth(selectedSession.month);
    setSessionEditYear(selectedSession.year);

    if (!editingTradeId) {
      const month = String(selectedSession.month).padStart(2, "0");
      setTradeDate(`${selectedSession.year}-${month}-01`);
    }
  }, [selectedSession, editingTradeId]);

  function resetTradeForm() {
    setEditingTradeId(null);
    setTradeDate(initialDate);
    setTradeSide("long");
    setTradeOutcome("win");
    setTradeIsWarning(false);
    setTradeWarningReason("");
    setTradeRValue(OUTCOME_DEFAULT_R.win);
    setTradeNotes("");
    setTradeChartUrl("");
  }

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!canEdit) {
      setError("Read-only mode is enabled.");
      return;
    }

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          pair: sessionPair,
          month: sessionMonth,
          year: sessionYear,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          setIsEditAuthorized(false);
        }
        throw new Error(result.error ?? "Unable to create session.");
      }

      await loadSessions();
      setSelectedSessionId(result.session.id);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unknown error";
      setError(message);
    }
  }

  async function handleUpdateSession() {
    if (!canEdit) {
      setError("Read-only mode is enabled.");
      return;
    }

    if (!selectedSessionId) {
      setError("Select a session first.");
      return;
    }

    setError("");

    try {
      const response = await fetch("/api/sessions", {
        method: "PATCH",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          id: selectedSessionId,
          pair: sessionEditPair,
          month: sessionEditMonth,
          year: sessionEditYear,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          setIsEditAuthorized(false);
        }
        throw new Error(result.error ?? "Unable to update session.");
      }

      await loadSessions();
      setSelectedSessionId(result.session.id);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unknown error";
      setError(message);
    }
  }

  async function handleDeleteSession() {
    if (!canEdit) {
      setError("Read-only mode is enabled.");
      return;
    }

    if (!selectedSessionId) {
      setError("Select a session first.");
      return;
    }

    const confirmDelete = window.confirm("Delete this session and all related trades?");
    if (!confirmDelete) {
      return;
    }

    setError("");

    try {
      const response = await fetch(`/api/sessions?id=${selectedSessionId}`, {
        method: "DELETE",
        headers: buildRequestHeaders(false),
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setIsEditAuthorized(false);
        }
        throw new Error(result.error ?? "Unable to delete session.");
      }

      setTrades([]);
      resetTradeForm();
      await loadSessions();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unknown error";
      setError(message);
    }
  }

  async function saveTrade() {
    setError("");

    if (!canEdit) {
      setError("Read-only mode is enabled.");
      return;
    }

    if (!selectedSessionId) {
      setError("Select a session first.");
      return;
    }

    if (tradeIsWarning && !tradeWarningReason.trim()) {
      setError("Warning trades require a reason.");
      return;
    }

    try {
      const method = editingTradeId ? "PATCH" : "POST";
      const response = await fetch("/api/trades", {
        method,
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          id: editingTradeId ?? undefined,
          sessionId: selectedSessionId,
          tradeDate,
          side: tradeSide,
          outcome: tradeOutcome,
          isWarning: tradeIsWarning,
          warningReason: tradeWarningReason,
          rValue: Number(tradeRValue),
          notes: tradeNotes,
          chartUrl: tradeChartUrl,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          setIsEditAuthorized(false);
        }
        throw new Error(result.error ?? `Unable to ${editingTradeId ? "update" : "create"} trade.`);
      }

      resetTradeForm();
      await loadTrades(activeTradeSessionIds);
      await loadSessions();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unknown error";
      setError(message);
    }
  }

  async function handleSaveTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveTrade();
  }

  function startEditingTrade(trade: Trade) {
    setEditingTradeId(trade.id);
    setTradeDate(trade.trade_date);
    setTradeSide(trade.side);
    setTradeOutcome(trade.outcome);
    setTradeIsWarning(trade.is_warning);
    setTradeWarningReason(trade.warning_reason ?? "");
    setTradeRValue(String(trade.r_value));
    setTradeNotes(trade.notes ?? "");
    setTradeChartUrl(trade.chart_url ?? "");
  }

  async function handleDeleteTrade(tradeId: string) {
    if (!canEdit) {
      setError("Read-only mode is enabled.");
      return;
    }

    const confirmDelete = window.confirm("Delete this trade?");
    if (!confirmDelete) {
      return;
    }

    setError("");

    try {
      const response = await fetch(`/api/trades?id=${tradeId}`, {
        method: "DELETE",
        headers: buildRequestHeaders(false),
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setIsEditAuthorized(false);
        }
        throw new Error(result.error ?? "Unable to delete trade.");
      }

      if (editingTradeId === tradeId) {
        resetTradeForm();
      }

      await loadTrades(activeTradeSessionIds);
      await loadSessions();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unknown error";
      setError(message);
    }
  }

  const years = useMemo(() => {
    const currentYear = now.getFullYear();
    return Array.from({ length: currentYear - 2020 + 1 }, (_, index) => currentYear - index);
  }, []);

  const statsTrades = useMemo(() => trades.filter((trade) => !trade.is_warning), [trades]);

  const summary = useMemo(() => {
    const totalTrades = statsTrades.length;
    const wins = statsTrades.filter((trade) => trade.outcome === "win");
    const losses = statsTrades.filter((trade) => trade.outcome === "lose");
    const breakeven = statsTrades.filter((trade) => trade.outcome === "be");

    const winCount = wins.length;
    const lossCount = losses.length;
    const beCount = breakeven.length;

    const grossProfitR = wins.reduce((sum, trade) => sum + Number(trade.r_value), 0);
    const grossLossR = losses.reduce((sum, trade) => sum + Number(trade.r_value), 0);
    const totalR = statsTrades.reduce((sum, trade) => sum + Number(trade.r_value), 0);

    const averageR = totalTrades > 0 ? totalR / totalTrades : 0;
    const averageWinR = winCount > 0 ? grossProfitR / winCount : 0;
    const averageLossR = lossCount > 0 ? Math.abs(grossLossR / lossCount) : 0;

    const decisiveTrades = winCount + lossCount;
    const winRate = decisiveTrades > 0 ? (winCount / decisiveTrades) * 100 : 0;
    const lossRate = decisiveTrades > 0 ? (lossCount / decisiveTrades) * 100 : 0;
    const beRate = totalTrades > 0 ? (beCount / totalTrades) * 100 : 0;

    const profitFactor = Math.abs(grossLossR) > 0 ? grossProfitR / Math.abs(grossLossR) : null;

    const sortedTrades = [...statsTrades].sort((a, b) => {
      const dateCompare = a.trade_date.localeCompare(b.trade_date);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return a.created_at.localeCompare(b.created_at);
    });

    let bestWinStreak = 0;
    let bestLossStreak = 0;
    let bestBeStreak = 0;
    let currentOutcome: Trade["outcome"] | null = null;
    let currentStreak = 0;

    sortedTrades.forEach((trade) => {
      if (trade.outcome === currentOutcome) {
        currentStreak += 1;
      } else {
        currentOutcome = trade.outcome;
        currentStreak = 1;
      }

      if (trade.outcome === "win") {
        bestWinStreak = Math.max(bestWinStreak, currentStreak);
      }
      if (trade.outcome === "lose") {
        bestLossStreak = Math.max(bestLossStreak, currentStreak);
      }
      if (trade.outcome === "be") {
        bestBeStreak = Math.max(bestBeStreak, currentStreak);
      }
    });

    const latestStreakType = sortedTrades.length > 0 ? sortedTrades[sortedTrades.length - 1].outcome : null;
    let latestStreakValue = 0;
    for (let index = sortedTrades.length - 1; index >= 0; index -= 1) {
      if (sortedTrades[index].outcome === latestStreakType) {
        latestStreakValue += 1;
      } else {
        break;
      }
    }

    const longTrades = statsTrades.filter((trade) => trade.side === "long");
    const shortTrades = statsTrades.filter((trade) => trade.side === "short");
    const longR = longTrades.reduce((sum, trade) => sum + Number(trade.r_value), 0);
    const shortR = shortTrades.reduce((sum, trade) => sum + Number(trade.r_value), 0);

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    sortedTrades.forEach((trade) => {
      equity += Number(trade.r_value);
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
    });

    const uniqueTradeDays = new Set(statsTrades.map((trade) => trade.trade_date)).size;
    const tradesPerDay = uniqueTradeDays > 0 ? totalTrades / uniqueTradeDays : 0;

    return {
      totalTrades,
      totalR,
      winCount,
      lossCount,
      beCount,
      winRate,
      lossRate,
      beRate,
      grossProfitR,
      grossLossR,
      averageR,
      averageWinR,
      averageLossR,
      profitFactor,
      expectancy: averageR,
      bestWinStreak,
      bestLossStreak,
      bestBeStreak,
      latestStreakType,
      latestStreakValue,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      longR,
      shortR,
      maxDrawdown,
      uniqueTradeDays,
      tradesPerDay,
    };
  }, [statsTrades]);

  const monthlyPnl = useMemo(() => {
    const byMonth = new Map<string, number>();

    statsTrades.forEach((trade) => {
      const key = trade.trade_date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(trade.r_value));
    });

    return [...byMonth.entries()]
      .map(([key, totalR]) => {
        const [yearString, monthString] = key.split("-");
        const month = Number(monthString);
        const year = Number(yearString);
        return {
          key,
          label: `${monthLabel(month)} ${year}`,
          totalR: Number(totalR.toFixed(2)),
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [statsTrades]);

  const yearlyPnl = useMemo(() => {
    const byYear = new Map<string, number>();

    statsTrades.forEach((trade) => {
      const year = trade.trade_date.slice(0, 4);
      byYear.set(year, (byYear.get(year) ?? 0) + Number(trade.r_value));
    });

    return [...byYear.entries()]
      .map(([year, totalR]) => ({
        year,
        totalR: Number(totalR.toFixed(2)),
      }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [statsTrades]);

  const tradesByRecency = useMemo(() => {
    return [...trades].sort((a, b) => {
      const dateCompare = b.trade_date.localeCompare(a.trade_date);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [trades]);

  function toggleLinkedSession(sessionId: string) {
    setLinkedSessionIds((current) => {
      if (current.includes(sessionId)) {
        return current.filter((id) => id !== sessionId);
      }
      return [...current, sessionId];
    });
  }

  function linkAllSessions() {
    setLinkedSessionIds(sessions.map((session) => session.id));
  }

  function clearLinkedSessions() {
    setLinkedSessionIds([]);
  }

  const recapScopeLabel = linkedSessionIds.length > 0 ? "Linked Sessions" : "Selected Session";

  return (
    <main className="min-h-screen bg-background px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-6">
        <header className="rounded-2xl border border-foreground/20 bg-foreground/5 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/70">Trading Analytics Platform</p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Backtest Journal</h1>
              <p className="mt-2 text-sm text-foreground/75">
                Build sessions, track trades, and review a full performance recap with institutional-style metrics.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full border border-foreground/30 bg-background/80 px-3 py-1.5 text-sm font-medium shadow-sm transition hover:scale-[1.02] sm:w-auto"
              aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-foreground/20 bg-foreground/10 text-xs">
                {themeMode === "dark" ? "☀️" : "🌙"}
              </span>
              <span>{themeMode === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </button>
          </div>

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
        </header>

        <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
          <aside className="rounded-2xl border border-foreground/20 bg-foreground/5 p-4 sm:p-5">
            {canEdit ? (
              <>
                <h2 className="text-base font-semibold">Create Session</h2>
                <p className="mt-1 text-sm text-foreground/70">Choose pair, month, and year to start a new journal block.</p>

                <form onSubmit={handleCreateSession} className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-sm">
                    Pair
                    <select
                      value={sessionPair}
                      onChange={(event) => setSessionPair(event.target.value)}
                      className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    >
                      {PAIR_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((pair) => (
                            <option key={pair} value={pair}>
                              {pair}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm">
                    Month
                    <select
                      value={sessionMonth}
                      onChange={(event) => setSessionMonth(Number(event.target.value))}
                      className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    >
                      {MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm">
                    Year
                    <select
                      value={sessionYear}
                      onChange={(event) => setSessionYear(Number(event.target.value))}
                      className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="submit"
                    disabled={!canEdit}
                    className="mt-1 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Create Session
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold">Read-only View</h2>
                <p className="mt-1 text-sm text-foreground/70">You can browse sessions, summaries, and trade logs.</p>
              </>
            )}

            <div className="mt-6 border-t border-foreground/15 pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Sessions</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={linkAllSessions}
                  disabled={sessions.length === 0}
                  className="rounded-md border border-foreground/30 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Link all
                </button>
                <button
                  type="button"
                  onClick={clearLinkedSessions}
                  disabled={linkedSessionIds.length === 0}
                  className="rounded-md border border-foreground/30 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear links
                </button>
                <span className="self-center text-xs text-foreground/70">
                  {linkedSessionIds.length > 0 ? `${linkedSessionIds.length} linked` : "No linked sessions"}
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {sessions.length === 0 && <p className="text-sm text-foreground/70">No sessions yet.</p>}
                {sessions.map((session) => {
                  const active = selectedSessionId === session.id;
                  const linked = linkedSessionIds.includes(session.id);
                  return (
                    <div
                      key={session.id}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        active ? "border-foreground bg-foreground text-background" : "border-foreground/20 bg-background"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => setSelectedSessionId(session.id)} className="min-w-0 flex-1 text-left">
                          <div className="text-sm font-medium">
                            {session.pair} · {monthLabel(session.month)} {session.year}
                          </div>
                          <div className={`text-xs ${active ? "text-background/80" : "text-foreground/70"}`}>
                            {session.totalTrades} trades · {formatR(session.totalR)}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleLinkedSession(session.id)}
                          className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
                            active
                              ? "border-background/50 bg-background/15 text-background"
                              : linked
                                ? "border-foreground/40 bg-foreground/10"
                                : "border-foreground/30"
                          }`}
                        >
                          {linked ? "Linked" : "Link"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-2xl border border-foreground/20 bg-foreground/5 p-4 sm:p-5">
              <h2 className="text-lg font-semibold">{canEdit ? "Active Session" : "Viewing Session"}</h2>
              {selectedSession ? (
                <p className="mt-1 text-sm text-foreground/75">
                  {selectedSession.pair} · {monthLabel(selectedSession.month)} {selectedSession.year}
                </p>
              ) : (
                <p className="mt-1 text-sm text-foreground/75">Create or select a session to begin.</p>
              )}
              {linkedSessionIds.length > 0 && (
                <p className="mt-2 text-xs uppercase tracking-wide text-foreground/70">
                  Aggregating metrics across {linkedSessionIds.length} linked sessions
                </p>
              )}

              {selectedSession && canEdit && (
                <div className="mt-4 grid gap-3 rounded-xl border border-foreground/20 bg-background p-4 md:grid-cols-3">
                  <label className="grid gap-1 text-sm">
                    Pair
                    <select
                      value={sessionEditPair}
                      onChange={(event) => setSessionEditPair(event.target.value)}
                      className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    >
                      {PAIR_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((pair) => (
                            <option key={pair} value={pair}>
                              {pair}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm">
                    Month
                    <select
                      value={sessionEditMonth}
                      onChange={(event) => setSessionEditMonth(Number(event.target.value))}
                      className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    >
                      {MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm">
                    Year
                    <select
                      value={sessionEditYear}
                      onChange={(event) => setSessionEditYear(Number(event.target.value))}
                      className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>

                  {canEdit && (
                    <div className="md:col-span-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleUpdateSession()}
                        className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background sm:w-auto"
                      >
                        Update Session
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSession()}
                        className="w-full rounded-lg border border-foreground/30 px-4 py-2 text-sm font-medium sm:w-auto"
                      >
                        Delete Session
                      </button>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="mt-3 rounded-lg border border-foreground/30 bg-background px-3 py-2 text-sm text-foreground">
                  {error}
                </p>
              )}
              {loading && <p className="mt-3 text-sm text-foreground/70">Loading...</p>}

              {!canEdit && <p className="mt-3 text-sm text-foreground/70">Editing inputs are hidden in read-only mode.</p>}

              {canEdit && (
                <>
                    <form onSubmit={handleSaveTrade} className="mt-4 grid gap-3 rounded-xl border border-foreground/20 bg-background p-4">
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
                    Side
                    <select
                      value={tradeSide}
                      onChange={(event) => setTradeSide(event.target.value as "long" | "short")}
                      className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    >
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm">
                    Result
                    <select
                      value={tradeOutcome}
                      onChange={(event) => {
                        const outcome = event.target.value as "win" | "lose" | "be";
                        setTradeOutcome(outcome);
                        setTradeRValue(OUTCOME_DEFAULT_R[outcome]);
                      }}
                      className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    >
                      <option value="win">TP (Win)</option>
                      <option value="lose">SL (Loss)</option>
                      <option value="be">BE (Break-even)</option>
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm">
                    R Multiple
                    <input
                      type="number"
                      step="0.1"
                      value={tradeRValue}
                      onChange={(event) => setTradeRValue(event.target.value)}
                      className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    />
                  </label>
                </div>

                <label className="grid gap-1 text-sm">
                  Notes
                  <textarea
                    value={tradeNotes}
                    onChange={(event) => setTradeNotes(event.target.value)}
                    className="min-h-20 rounded-lg border border-foreground/20 bg-background px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  Chart URL
                  <input
                    type="url"
                    value={tradeChartUrl}
                    onChange={(event) => setTradeChartUrl(event.target.value)}
                    className="rounded-lg border border-foreground/20 bg-background px-3 py-2"
                    placeholder="https://..."
                  />
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={tradeIsWarning}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setTradeIsWarning(checked);
                      if (!checked) {
                        setTradeWarningReason("");
                      }
                    }}
                    className="h-4 w-4"
                  />
                  Mark as Warning Trade (excluded from stats)
                </label>

                {tradeIsWarning && (
                  <label className="grid gap-1 text-sm">
                    Warning Reason
                    <textarea
                      required
                      value={tradeWarningReason}
                      onChange={(event) => setTradeWarningReason(event.target.value)}
                      className="min-h-16 rounded-lg border border-foreground/20 bg-background px-3 py-2"
                      placeholder="Explain why this trade should be excluded from stats"
                    />
                  </label>
                )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={!canEdit}
                        className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
                      >
                        {editingTradeId ? "Update Trade" : "Add Trade"}
                      </button>
                      {editingTradeId && (
                        <button
                          type="button"
                          onClick={resetTradeForm}
                          className="w-full rounded-lg border border-foreground/30 px-4 py-2 text-sm font-medium sm:w-fit"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-foreground/20 bg-foreground/5 p-4 sm:p-5">
              <h3 className="text-lg font-semibold">Session Summary</h3>
              <p className="mt-1 text-sm text-foreground/70">Comprehensive recap: distribution, streaks, risk, and performance quality.</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-foreground/60">Warning trades are excluded from all stats and recaps.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-foreground/20 bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-foreground/60">Net R</p>
                  <p className="mt-1 text-xl font-semibold">{formatR(summary.totalR)}</p>
                </div>
                <div className="rounded-lg border border-foreground/20 bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-foreground/60">Total Trades</p>
                  <p className="mt-1 text-xl font-semibold">{summary.totalTrades}</p>
                </div>
                <div className="rounded-lg border border-foreground/20 bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-foreground/60">Win Rate</p>
                  <p className="mt-1 text-xl font-semibold">{formatPercent(summary.winRate)}</p>
                </div>
                <div className="rounded-lg border border-foreground/20 bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-foreground/60">Profit Factor</p>
                  <p className="mt-1 text-xl font-semibold">
                    {summary.profitFactor === null ? "—" : summary.profitFactor.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                <div className="rounded-lg border border-foreground/20 bg-background p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Outcome Breakdown</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>TP (Win): {summary.winCount} · {formatPercent(summary.winRate)}</p>
                    <p>SL (Loss): {summary.lossCount} · {formatPercent(summary.lossRate)}</p>
                    <p>BE: {summary.beCount} · {formatPercent(summary.beRate)}</p>
                    <p>Gross Profit: {formatR(summary.grossProfitR)}</p>
                    <p>Gross Loss: {summary.grossLossR.toFixed(2)}R</p>
                  </div>
                </div>

                <div className="rounded-lg border border-foreground/20 bg-background p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Execution Quality</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>Expectancy: {formatR(summary.expectancy)}</p>
                    <p>Average R / Trade: {formatR(summary.averageR)}</p>
                    <p>Average Win: {formatR(summary.averageWinR)}</p>
                    <p>Average Loss: -{summary.averageLossR.toFixed(2)}R</p>
                    <p>Max Drawdown: -{summary.maxDrawdown.toFixed(2)}R</p>
                  </div>
                </div>

                <div className="rounded-lg border border-foreground/20 bg-background p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Streak Analytics</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>Max TP Streak: {summary.bestWinStreak}</p>
                    <p>Max SL Streak: {summary.bestLossStreak}</p>
                    <p>Max BE Streak: {summary.bestBeStreak}</p>
                    <p>
                      Current Streak: {summary.latestStreakValue} {summary.latestStreakType ? `(${summary.latestStreakType.toUpperCase()})` : ""}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-foreground/20 bg-background p-4 text-sm">
                  <h4 className="font-semibold uppercase tracking-wide text-foreground/70">Side Performance</h4>
                  <p className="mt-2">Long: {summary.longTrades} trades · {formatR(summary.longR)}</p>
                  <p>Short: {summary.shortTrades} trades · {formatR(summary.shortR)}</p>
                </div>
                <div className="rounded-lg border border-foreground/20 bg-background p-4 text-sm">
                  <h4 className="font-semibold uppercase tracking-wide text-foreground/70">Activity</h4>
                  <p className="mt-2">Trading Days: {summary.uniqueTradeDays}</p>
                  <p>Trades / Day: {summary.tradesPerDay.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-foreground/20 bg-background p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Monthly P&L Recap ({recapScopeLabel} · by trade date)</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {monthlyPnl.map((month) => (
                    <div key={month.key} className="rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-foreground/70">{month.label}</p>
                      <p className="mt-1 text-lg font-semibold">{formatR(month.totalR)}</p>
                    </div>
                  ))}
                  {monthlyPnl.length === 0 && <p className="text-sm text-foreground/70">No monthly data yet.</p>}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-foreground/20 bg-background p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Yearly P&L Recap ({recapScopeLabel} · by trade date)</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {yearlyPnl.map((year) => (
                    <div key={year.year} className="rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-foreground/70">{year.year}</p>
                      <p className="mt-1 text-lg font-semibold">{formatR(year.totalR)}</p>
                    </div>
                  ))}
                  {yearlyPnl.length === 0 && <p className="text-sm text-foreground/70">No yearly data yet.</p>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/20 bg-foreground/5 p-4 sm:p-5">
              <h3 className="text-lg font-semibold">Trade Log</h3>

              <div className="mt-4 grid gap-3 md:hidden">
                {tradesByRecency.map((trade) => (
                  <article
                    key={trade.id}
                    className={`rounded-lg border p-3 text-sm ${trade.is_warning ? "border-amber-500/60 bg-amber-500/10" : "border-foreground/20 bg-background"}`}
                  >
                    {editingTradeId === trade.id ? (
                      <div className="grid gap-2">
                        <label className="grid gap-1 text-xs uppercase tracking-wide text-foreground/70">
                          Date
                          <input
                            type="date"
                            value={tradeDate}
                            onChange={(event) => setTradeDate(event.target.value)}
                            className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="grid gap-1 text-xs uppercase tracking-wide text-foreground/70">
                            Side
                            <select
                              value={tradeSide}
                              onChange={(event) => setTradeSide(event.target.value as "long" | "short")}
                              className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
                            >
                              <option value="long">Long</option>
                              <option value="short">Short</option>
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs uppercase tracking-wide text-foreground/70">
                            Result
                            <select
                              value={tradeOutcome}
                              onChange={(event) => {
                                const outcome = event.target.value as "win" | "lose" | "be";
                                setTradeOutcome(outcome);
                              }}
                              className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
                            >
                              <option value="win">TP</option>
                              <option value="lose">SL</option>
                              <option value="be">BE</option>
                            </select>
                          </label>
                        </div>
                        <label className="grid gap-1 text-xs uppercase tracking-wide text-foreground/70">
                          R
                          <input
                            type="number"
                            step="0.1"
                            value={tradeRValue}
                            onChange={(event) => setTradeRValue(event.target.value)}
                            className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="grid gap-1 text-xs uppercase tracking-wide text-foreground/70">
                          Notes
                          <textarea
                            value={tradeNotes}
                            onChange={(event) => setTradeNotes(event.target.value)}
                            className="min-h-16 rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/70">
                          <input
                            type="checkbox"
                            checked={tradeIsWarning}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setTradeIsWarning(checked);
                              if (!checked) {
                                setTradeWarningReason("");
                              }
                            }}
                            className="h-4 w-4"
                          />
                          Warning trade
                        </label>
                        {tradeIsWarning && (
                          <label className="grid gap-1 text-xs uppercase tracking-wide text-foreground/70">
                            Warning Reason
                            <textarea
                              required
                              value={tradeWarningReason}
                              onChange={(event) => setTradeWarningReason(event.target.value)}
                              className="min-h-16 rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
                            />
                          </label>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{trade.trade_date}</p>
                          <p className="text-xs uppercase text-foreground/70">{trade.side}</p>
                        </div>
                        <p className="mt-1 text-xs uppercase text-foreground/70">
                          {trade.outcome === "win" ? "TP" : trade.outcome === "lose" ? "SL" : "BE"} · {trade.r_value.toFixed(2)}R
                        </p>
                        {trade.is_warning && (
                          <p className="mt-1 inline-flex w-fit rounded-md border border-amber-500/60 bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                            Warning Trade
                          </p>
                        )}
                        {trade.is_warning && trade.warning_reason && <p className="mt-2 text-amber-200/90">Reason: {trade.warning_reason}</p>}
                        <p className="mt-2 text-foreground/80">{trade.notes || "—"}</p>
                      </>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trade.chart_url && (
                        <a href={trade.chart_url} target="_blank" rel="noreferrer" className="rounded-md border border-foreground/30 px-2 py-1 text-xs">
                          Open Chart
                        </a>
                      )}
                      {editingTradeId === trade.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveTrade()}
                            disabled={!canEdit}
                            className="rounded-md bg-foreground px-2 py-1 text-xs text-background disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={resetTradeForm}
                            className="rounded-md border border-foreground/30 px-2 py-1 text-xs"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditingTrade(trade)}
                          disabled={!canEdit}
                          className="rounded-md border border-foreground/30 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit
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
                    No trades in this session yet.
                  </div>
                )}
              </div>

              <div className="mt-4 hidden overflow-x-auto rounded-lg border border-foreground/20 bg-background md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-foreground/20 text-left text-xs uppercase tracking-wide text-foreground/70">
                      <th className="px-3 py-3 font-medium">Date</th>
                      <th className="px-3 py-3 font-medium">Side</th>
                      <th className="px-3 py-3 font-medium">Result</th>
                      <th className="px-3 py-3 font-medium">R</th>
                      <th className="px-3 py-3 font-medium">Notes</th>
                      <th className="px-3 py-3 font-medium">Chart</th>
                      <th className="px-3 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradesByRecency.map((trade) => (
                      <tr key={trade.id} className={`border-b align-top ${trade.is_warning ? "border-amber-500/40 bg-amber-500/10" : "border-foreground/10"}`}>
                        <td className="px-3 py-3">
                          {editingTradeId === trade.id ? (
                            <input
                              type="date"
                              value={tradeDate}
                              onChange={(event) => setTradeDate(event.target.value)}
                              className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1"
                            />
                          ) : (
                            trade.trade_date
                          )}
                        </td>
                        <td className="px-3 py-3 uppercase">
                          {editingTradeId === trade.id ? (
                            <select
                              value={tradeSide}
                              onChange={(event) => setTradeSide(event.target.value as "long" | "short")}
                              className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1"
                            >
                              <option value="long">Long</option>
                              <option value="short">Short</option>
                            </select>
                          ) : (
                            trade.side
                          )}
                        </td>
                        <td className="px-3 py-3 uppercase">
                          {editingTradeId === trade.id ? (
                            <select
                              value={tradeOutcome}
                              onChange={(event) => {
                                const outcome = event.target.value as "win" | "lose" | "be";
                                setTradeOutcome(outcome);
                              }}
                              className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1"
                            >
                              <option value="win">TP</option>
                              <option value="lose">SL</option>
                              <option value="be">BE</option>
                            </select>
                          ) : (
                            <div className="space-y-1">
                              <p>{trade.outcome === "win" ? "TP" : trade.outcome === "lose" ? "SL" : "BE"}</p>
                              {trade.is_warning && (
                                <p className="inline-flex w-fit rounded-md border border-amber-500/60 bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                                  Warning
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {editingTradeId === trade.id ? (
                            <input
                              type="number"
                              step="0.1"
                              value={tradeRValue}
                              onChange={(event) => setTradeRValue(event.target.value)}
                              className="w-24 rounded-md border border-foreground/20 bg-background px-2 py-1"
                            />
                          ) : (
                            `${trade.r_value.toFixed(2)}R`
                          )}
                        </td>
                        <td className="px-3 py-3 text-foreground/80">
                          {editingTradeId === trade.id ? (
                            <textarea
                              value={tradeNotes}
                              onChange={(event) => setTradeNotes(event.target.value)}
                              className="w-full min-w-40 rounded-md border border-foreground/20 bg-background px-2 py-1"
                            />
                          ) : (
                            <div className="space-y-1">
                              <p>{trade.notes || "—"}</p>
                              {trade.is_warning && trade.warning_reason && <p className="text-amber-200/90">Reason: {trade.warning_reason}</p>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {trade.chart_url ? (
                            <a href={trade.chart_url} target="_blank" rel="noreferrer" className="underline">
                              Open
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {editingTradeId === trade.id && (
                              <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/70">
                                <input
                                  type="checkbox"
                                  checked={tradeIsWarning}
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    setTradeIsWarning(checked);
                                    if (!checked) {
                                      setTradeWarningReason("");
                                    }
                                  }}
                                  className="h-4 w-4"
                                />
                                Warning
                              </label>
                            )}
                            {editingTradeId === trade.id && tradeIsWarning && (
                              <textarea
                                required
                                value={tradeWarningReason}
                                onChange={(event) => setTradeWarningReason(event.target.value)}
                                className="w-full min-w-40 rounded-md border border-foreground/20 bg-background px-2 py-1"
                                placeholder="Warning reason"
                              />
                            )}
                            {editingTradeId === trade.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void saveTrade()}
                                  disabled={!canEdit}
                                  className="rounded-md bg-foreground px-2 py-1 text-xs text-background disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Update
                                </button>
                                <button
                                  type="button"
                                  onClick={resetTradeForm}
                                  className="rounded-md border border-foreground/30 px-2 py-1 text-xs"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditingTrade(trade)}
                                disabled={!canEdit}
                                className="rounded-md border border-foreground/30 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Edit
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
                        <td colSpan={7} className="px-3 py-6 text-center text-foreground/70">
                          No trades in this session yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <footer className="text-center text-xs uppercase tracking-wide text-foreground/60">made by hqgambler</footer>
      </div>
    </main>
  );
}
