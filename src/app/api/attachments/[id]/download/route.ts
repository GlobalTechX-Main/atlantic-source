import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { getAuthorizedAttachmentFile } from "@/lib/rfq/attachment-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const user = await getCurrentUserSession();

    const userOrToken = {
      userId: user?.id,
      buyerOrgId: user?.buyerMemberships[0]?.buyerOrganizationId,
      supplierCompanyId: user?.supplierMemberships[0]?.supplierCompanyId,
    };

    const fileResult = await getAuthorizedAttachmentFile(resolvedParams.id, userOrToken);

    return new Response(fileResult.buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": fileResult.mimeType,
        "Content-Disposition": `attachment; filename="${fileResult.fileName}"`,
      },
    });
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
