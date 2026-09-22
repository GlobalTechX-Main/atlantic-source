import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { processOneClickResponse, submitIndicativeQuote } from "@/lib/rfq/supplier-response-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.type === "QUOTE") {
      const result = await submitIndicativeQuote({
        tokenString: body.token,
        indicativeQuote: body.indicativeQuote,
        currency: body.currency,
        leadTime: body.leadTime,
        message: body.message,
        attachmentId: body.attachmentId,
      });
      return NextResponse.json(result, { status: 200 });
    }

    const result = await processOneClickResponse({
      tokenString: body.token,
      message: body.message,
      declineReason: body.declineReason,
    });

    return NextResponse.json(result, { status: 200 });
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
