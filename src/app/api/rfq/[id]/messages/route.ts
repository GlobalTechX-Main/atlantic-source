import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { getRFQMessageThread, sendRFQMessage } from "@/lib/rfq/messaging-service";
import { verifyRFQResponseToken } from "@/lib/rfq/token";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { searchParams } = new URL(req.url);
    const recipientId = searchParams.get("recipientId");
    const token = searchParams.get("token");

    if (!recipientId) {
      return NextResponse.json({ error: "recipientId query parameter is required" }, { status: 400 });
    }

    const user = await getCurrentUserSession();
    let authContext: { buyerOrgId?: string; supplierCompanyId?: string; isPlatformAdmin?: boolean } = {};

    if (user) {
      authContext = {
        buyerOrgId: user.buyerMemberships[0]?.buyerOrganizationId,
        supplierCompanyId: user.supplierMemberships[0]?.supplierCompanyId,
        isPlatformAdmin: user.isPlatformAdmin,
      };
    } else if (token) {
      const payload = verifyRFQResponseToken(token);
      authContext = {
        supplierCompanyId: payload.supplierCompanyId,
      };
    } else {
      return NextResponse.json({ error: "Authentication or response token required" }, { status: 401 });
    }

    const messages = await getRFQMessageThread(resolvedParams.id, recipientId, authContext);
    return NextResponse.json({ messages }, { status: 200 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    const user = await getCurrentUserSession();

    let senderType: "BUYER" | "SUPPLIER" = "BUYER";
    let buyerOrgId: string | undefined;
    let supplierCompanyId: string | undefined;
    let senderUserId: string | undefined;

    if (user) {
      senderUserId = user.id;
      if (body.senderType === "SUPPLIER" || user.supplierMemberships.length > 0) {
        senderType = "SUPPLIER";
        supplierCompanyId = user.supplierMemberships[0]?.supplierCompanyId;
      } else {
        senderType = "BUYER";
        buyerOrgId = user.buyerMemberships[0]?.buyerOrganizationId;
      }
    } else if (body.token) {
      const payload = verifyRFQResponseToken(body.token);
      senderType = "SUPPLIER";
      supplierCompanyId = payload.supplierCompanyId;
    } else {
      return NextResponse.json({ error: "Authentication or token required" }, { status: 401 });
    }

    const message = await sendRFQMessage({
      sourcingRequestId: resolvedParams.id,
      recipientId: body.recipientId,
      senderType,
      senderUserId,
      buyerOrgId,
      supplierCompanyId,
      message: body.message,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
