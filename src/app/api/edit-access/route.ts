import { NextResponse } from "next/server";

import { ensureEditAccess } from "@/lib/edit-access";

export async function POST(request: Request) {
  const denied = ensureEditAccess(request);
  if (denied) {
    return denied;
  }

  return NextResponse.json({ ok: true });
}
