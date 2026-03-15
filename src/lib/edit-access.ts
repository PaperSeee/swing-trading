import { NextResponse } from "next/server";

const READ_ONLY_MESSAGE = "Read-only mode is enabled.";

export function ensureEditAccess(request: Request) {
  const expectedKey = process.env.EDIT_ACCESS_KEY;

  if (!expectedKey) {
    if (process.env.NODE_ENV !== "production") {
      return null;
    }

    return NextResponse.json({ error: READ_ONLY_MESSAGE }, { status: 403 });
  }

  const providedKey = request.headers.get("x-edit-key")?.trim();
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: READ_ONLY_MESSAGE }, { status: 403 });
  }

  return null;
}
