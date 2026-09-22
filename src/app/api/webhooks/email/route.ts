import { NextResponse } from "next/server";
import { defaultEmailProvider } from "@/lib/email/email-provider";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-email-signature") || "";
    const body = await req.json();

    const handled = await defaultEmailProvider.handleWebhook(body, signature);

    if (!handled) {
      return NextResponse.json({ error: "Webhook signature invalid or event target not found" }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
