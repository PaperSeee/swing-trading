import { NextResponse } from "next/server";

import { ensureEditAccess } from "@/lib/edit-access";
import { getSupabaseServerClient } from "@/lib/supabase";

type LiveStatus = "limit" | "running" | "closed";
type LiveOutcome = "tp" | "sl" | "be";

function isValidStatus(value: string): value is LiveStatus {
  return ["limit", "running", "closed"].includes(value);
}

function isValidOutcome(value: string): value is LiveOutcome {
  return ["tp", "sl", "be"].includes(value);
}

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("live_trades")
      .select("id, trade_date, pair, side, status, outcome, r_value, notes, is_validated, validation_notes, validated_at, created_at")
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false });

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
  const denied = ensureEditAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const payload = (await request.json()) as {
      tradeDate?: string;
      pair?: string;
      side?: "long" | "short";
      status?: LiveStatus;
      outcome?: LiveOutcome | null;
      rValue?: number | null;
      notes?: string;
      isValidated?: boolean;
      validationNotes?: string;
    };

    const tradeDate = payload.tradeDate;
    const pair = payload.pair?.trim();
    const side = payload.side;
    const status = payload.status;
    const outcome = payload.outcome ?? null;
    const rValue = payload.rValue == null ? null : Number(payload.rValue);
    const notes = payload.notes?.trim() || null;
    const isValidated = Boolean(payload.isValidated);
    const validationNotes = payload.validationNotes?.trim() || null;

    if (!tradeDate || !pair || !side || !status) {
      return NextResponse.json({ error: "Invalid live trade payload." }, { status: 400 });
    }

    if (!["long", "short"].includes(side)) {
      return NextResponse.json({ error: "Side must be long or short." }, { status: 400 });
    }

    if (!isValidStatus(status)) {
      return NextResponse.json({ error: "Status must be limit, running, or closed." }, { status: 400 });
    }

    if (status === "closed" && (!outcome || !isValidOutcome(outcome))) {
      return NextResponse.json({ error: "Closed trades require an outcome (tp, sl, or be)." }, { status: 400 });
    }

    if (status !== "closed" && outcome !== null) {
      return NextResponse.json({ error: "Outcome must be empty unless status is closed." }, { status: 400 });
    }

    if (rValue != null && Number.isNaN(rValue)) {
      return NextResponse.json({ error: "R value must be numeric." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("live_trades")
      .insert({
        trade_date: tradeDate,
        pair,
        side,
        status,
        outcome,
        r_value: rValue,
        notes,
        is_validated: isValidated,
        validation_notes: validationNotes,
        validated_at: isValidated ? new Date().toISOString() : null,
      })
      .select("id, trade_date, pair, side, status, outcome, r_value, notes, is_validated, validation_notes, validated_at, created_at")
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
  const denied = ensureEditAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const payload = (await request.json()) as {
      id?: string;
      tradeDate?: string;
      pair?: string;
      side?: "long" | "short";
      status?: LiveStatus;
      outcome?: LiveOutcome | null;
      rValue?: number | null;
      notes?: string;
      isValidated?: boolean;
      validationNotes?: string;
    };

    const id = payload.id?.trim();
    const tradeDate = payload.tradeDate;
    const pair = payload.pair?.trim();
    const side = payload.side;
    const status = payload.status;
    const outcome = payload.outcome ?? null;
    const rValue = payload.rValue == null ? null : Number(payload.rValue);
    const notes = payload.notes?.trim() || null;
    const isValidated = Boolean(payload.isValidated);
    const validationNotes = payload.validationNotes?.trim() || null;

    if (!id || !tradeDate || !pair || !side || !status) {
      return NextResponse.json({ error: "Invalid live trade payload." }, { status: 400 });
    }

    if (!["long", "short"].includes(side)) {
      return NextResponse.json({ error: "Side must be long or short." }, { status: 400 });
    }

    if (!isValidStatus(status)) {
      return NextResponse.json({ error: "Status must be limit, running, or closed." }, { status: 400 });
    }

    if (status === "closed" && (!outcome || !isValidOutcome(outcome))) {
      return NextResponse.json({ error: "Closed trades require an outcome (tp, sl, or be)." }, { status: 400 });
    }

    if (status !== "closed" && outcome !== null) {
      return NextResponse.json({ error: "Outcome must be empty unless status is closed." }, { status: 400 });
    }

    if (rValue != null && Number.isNaN(rValue)) {
      return NextResponse.json({ error: "R value must be numeric." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from("live_trades")
      .select("is_validated")
      .eq("id", id)
      .single();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const shouldStampValidation = isValidated && !existing?.is_validated;

    const { data, error } = await supabase
      .from("live_trades")
      .update({
        trade_date: tradeDate,
        pair,
        side,
        status,
        outcome,
        r_value: rValue,
        notes,
        is_validated: isValidated,
        validation_notes: validationNotes,
        validated_at: shouldStampValidation ? new Date().toISOString() : existing?.is_validated ? undefined : null,
      })
      .eq("id", id)
      .select("id, trade_date, pair, side, status, outcome, r_value, notes, is_validated, validation_notes, validated_at, created_at")
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
    const { error } = await supabase.from("live_trades").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
