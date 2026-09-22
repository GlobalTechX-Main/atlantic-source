import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { sendSourcingRequest } from "@/lib/rfq/sourcing-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserSession();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const resolvedParams = await params;
    const rfq = await sendSourcingRequest(resolvedParams.id, user);
    return NextResponse.json({ rfq, success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
