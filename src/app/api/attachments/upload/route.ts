import { NextResponse } from "next/server";
import { AttachmentOwnerTypeEnum } from "@prisma/client";
import { getCurrentUserSession } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";
import { uploadPrivateAttachment } from "@/lib/rfq/attachment-service";
import { verifyRFQResponseToken } from "@/lib/rfq/token";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const ownerType = formData.get("ownerType") as AttachmentOwnerTypeEnum | null;
    const ownerId = formData.get("ownerId") as string | null;
    const token = formData.get("token") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (!ownerType || !ownerId) {
      return NextResponse.json({ error: "ownerType and ownerId are required" }, { status: 400 });
    }

    const user = await getCurrentUserSession();
    if (!user && !token) {
      return NextResponse.json({ error: "Authentication or response token required to upload" }, { status: 401 });
    }

    if (token) {
      verifyRFQResponseToken(token);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const attachment = await uploadPrivateAttachment({
      ownerType,
      ownerId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
