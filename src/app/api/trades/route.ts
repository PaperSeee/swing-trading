import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("trades")
      .select("id, session_id, trade_date, side, outcome, r_value, notes, chart_url, created_at")
      .eq("session_id", sessionId)
      .order("trade_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trades: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      sessionId?: string;
      tradeDate?: string;
      side?: "long" | "short";
      outcome?: "win" | "lose" | "be";
      rValue?: number;
      notes?: string;
      chartUrl?: string;
    };

    const sessionId = payload.sessionId?.trim();
    const tradeDate = payload.tradeDate;
    const side = payload.side;
    const outcome = payload.outcome;
    const rValue = Number(payload.rValue);
    const notes = payload.notes?.trim() || null;
    const chartUrl = payload.chartUrl?.trim() || null;

    if (!sessionId || !tradeDate || !side || !outcome || Number.isNaN(rValue)) {
      return NextResponse.json({ error: "Invalid trade payload." }, { status: 400 });
    }

    if (!["long", "short"].includes(side)) {
      return NextResponse.json({ error: "Side must be long or short." }, { status: 400 });
    }

    if (!["win", "lose", "be"].includes(outcome)) {
      return NextResponse.json({ error: "Outcome must be win, lose, or be." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("trades")
      .insert({
        session_id: sessionId,
        trade_date: tradeDate,
        side,
        outcome,
        r_value: rValue,
        notes,
        chart_url: chartUrl,
      })
      .select("id, session_id, trade_date, side, outcome, r_value, notes, chart_url, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trade: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      id?: string;
      tradeDate?: string;
      side?: "long" | "short";
      outcome?: "win" | "lose" | "be";
      rValue?: number;
      notes?: string;
      chartUrl?: string;
    };

    const id = payload.id?.trim();
    const tradeDate = payload.tradeDate;
    const side = payload.side;
    const outcome = payload.outcome;
    const rValue = Number(payload.rValue);
    const notes = payload.notes?.trim() || null;
    const chartUrl = payload.chartUrl?.trim() || null;

    if (!id || !tradeDate || !side || !outcome || Number.isNaN(rValue)) {
      return NextResponse.json({ error: "Invalid trade payload." }, { status: 400 });
    }

    if (!["long", "short"].includes(side)) {
      return NextResponse.json({ error: "Side must be long or short." }, { status: 400 });
    }

    if (!["win", "lose", "be"].includes(outcome)) {
      return NextResponse.json({ error: "Outcome must be win, lose, or be." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("trades")
      .update({
        trade_date: tradeDate,
        side,
        outcome,
        r_value: rValue,
        notes,
        chart_url: chartUrl,
      })
      .eq("id", id)
      .select("id, session_id, trade_date, side, outcome, r_value, notes, chart_url, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trade: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("trades").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}