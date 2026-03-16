import { NextResponse } from "next/server";

import { ensureEditAccess } from "@/lib/edit-access";
import { getSupabaseServerClient } from "@/lib/supabase";

type TradeRow = {
  session_id: string;
  outcome: "win" | "lose" | "be";
  r_value: number;
  is_warning: boolean;
};

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data: sessions, error: sessionsError } = await supabase
      .from("backtest_sessions")
      .select("id, pair, month, year, created_at")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .order("created_at", { ascending: false });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    const sessionIds = (sessions ?? []).map((session) => session.id);
    let trades: TradeRow[] = [];

    if (sessionIds.length > 0) {
      const { data: tradesData, error: tradesError } = await supabase
        .from("trades")
        .select("session_id, outcome, r_value, is_warning")
        .in("session_id", sessionIds);

      if (tradesError) {
        return NextResponse.json({ error: tradesError.message }, { status: 500 });
      }

      trades = (tradesData ?? []) as TradeRow[];
    }

    const statsBySessionId = new Map<string, { totalTrades: number; totalR: number }>();
    trades.forEach((trade) => {
      if (trade.is_warning) {
        return;
      }
      const current = statsBySessionId.get(trade.session_id) ?? { totalTrades: 0, totalR: 0 };
      current.totalTrades += 1;
      current.totalR += Number(trade.r_value);
      statsBySessionId.set(trade.session_id, current);
    });

    const enriched = (sessions ?? []).map((session) => {
      const stats = statsBySessionId.get(session.id) ?? { totalTrades: 0, totalR: 0 };
      return {
        ...session,
        totalTrades: stats.totalTrades,
        totalR: Number(stats.totalR.toFixed(2)),
      };
    });

    return NextResponse.json({ sessions: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = ensureEditAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const payload = (await request.json()) as {
      pair?: string;
      month?: number;
      year?: number;
    };

    const pair = payload.pair?.trim();
    const month = Number(payload.month);
    const year = Number(payload.year);

    if (!pair || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json({ error: "Invalid session payload." }, { status: 400 });
    }

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Month must be between 1 and 12." }, { status: 400 });
    }

    if (year < 2020 || year > 2100) {
      return NextResponse.json({ error: "Year must be between 2020 and 2100." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("backtest_sessions")
      .insert({ pair, month, year })
      .select("id, pair, month, year, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: { ...data, totalTrades: 0, totalR: 0 } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = ensureEditAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const payload = (await request.json()) as {
      id?: string;
      pair?: string;
      month?: number;
      year?: number;
    };

    const id = payload.id?.trim();
    const pair = payload.pair?.trim();
    const month = Number(payload.month);
    const year = Number(payload.year);

    if (!id || !pair || Number.isNaN(month) || Number.isNaN(year)) {
      return NextResponse.json({ error: "Invalid session payload." }, { status: 400 });
    }

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Month must be between 1 and 12." }, { status: 400 });
    }

    if (year < 2020 || year > 2100) {
      return NextResponse.json({ error: "Year must be between 2020 and 2100." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("backtest_sessions")
      .update({ pair, month, year })
      .eq("id", id)
      .select("id, pair, month, year, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = ensureEditAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("backtest_sessions").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}