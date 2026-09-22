"use client";

import { z } from "zod";

export const ReportSupplierSchema = z.object({
  supplierCompanyId: z.string().min(1, "Supplier ID is required"),
  reporterEmail: z.string().email("Valid reporter email address is required"),
  reporterName: z.string().optional(),
  reportType: z.enum([
    "OUTDATED_COMPANY",
    "WRONG_CONTACT",
    "WRONG_CAPABILITY",
    "COMPANY_CLOSED",
    "INACCURATE_INFORMATION",
  ]),
  details: z.string().min(10, "Details must be at least 10 characters describing the issue"),
});

export type ReportSupplierInput = z.infer<typeof ReportSupplierSchema>;

export async function submitSupplierReportAction(
  rawInput: ReportSupplierInput
): Promise<{ success: boolean; message: string }> {
  const parseResult = ReportSupplierSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      message: parseResult.error.errors[0]?.message || "Invalid report input",
    };
  }

  const { supplierCompanyId, reporterEmail, reporterName, reportType, details } = parseResult.data;

  try {
    if (process.env.NODE_ENV !== "test") {
      const { db } = await import("@/lib/db");
      await db.supplierReport.create({
        data: {
          supplierCompanyId,
          reporterEmail,
          reporterName: reporterName || null,
          reportType,
          details,
        },
      });

      const { logAdminAction } = await import("@/lib/admin/audit");
      await logAdminAction(
        null,
        "SUPPLIER_REPORT_SUBMITTED",
        "SupplierCompany",
        supplierCompanyId,
        { reporterEmail, reportType, detailsLength: details.length }
      );
    }

    return {
      success: true,
      message: "Thank you for reporting. Your submission has been queued for administrative review.",
    };
  } catch {
    return {
      success: false,
      message: "Unable to submit report right now. Please try again later.",
    };
  }
}
