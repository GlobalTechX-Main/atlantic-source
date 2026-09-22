import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { createSourcingRequest, getBuyerSourcingRequests } from "@/lib/rfq/sourcing-service";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserSession();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const rfq = await createSourcingRequest(user, body);
    return NextResponse.json({ rfq }, { status: 201 });
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

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserSession();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const buyerOrgId = searchParams.get("buyerOrgId");

    if (!buyerOrgId) {
      return NextResponse.json({ error: "buyerOrgId parameter is required" }, { status: 400 });
    }

    const rfqs = await getBuyerSourcingRequests(buyerOrgId, user);
    return NextResponse.json({ rfqs }, { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
