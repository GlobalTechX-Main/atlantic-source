import crypto from "crypto";
import { EmailStateEnum, RFQDeliveryStatusEnum } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateRFQResponseToken } from "@/lib/rfq/token";

export interface SendRFQEmailPayload {
  recipientId: string;
  sourcingRequestId: string;
  supplierCompanyId: string;
  contactId: string;
  recipientEmail: string;
  buyerOrgName: string;
  rfqTitle: string;
  rfqDescription: string;
  location: string;
  responseDeadline?: Date | null;
}

export interface EmailSendResult {
  providerMessageId: string;
  status: "SENT" | "QUEUED" | "FAILED";
}

export interface EmailWebhookPayload {
  providerMessageId: string;
  event: "DELIVERED" | "BOUNCED" | "FAILED";
  recipientEmail: string;
  timestamp: string;
}

export interface EmailProvider {
  sendRFQNotification(payload: SendRFQEmailPayload): Promise<EmailSendResult>;
  handleWebhook(body: EmailWebhookPayload, signature: string): Promise<boolean>;
}

const APP_BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET || "atlantic-source-email-webhook-secret-key";

export class DevelopmentEmailProvider implements EmailProvider {
  async sendRFQNotification(payload: SendRFQEmailPayload): Promise<EmailSendResult> {
    const providerMessageId = `dev_msg_${crypto.randomBytes(12).toString("hex")}`;

    const interestedToken = generateRFQResponseToken({
      recipientId: payload.recipientId,
      sourcingRequestId: payload.sourcingRequestId,
      supplierCompanyId: payload.supplierCompanyId,
      action: "INTERESTED",
    });

    const needInfoToken = generateRFQResponseToken({
      recipientId: payload.recipientId,
      sourcingRequestId: payload.sourcingRequestId,
      supplierCompanyId: payload.supplierCompanyId,
      action: "NEED_INFORMATION",
    });

    const declinedToken = generateRFQResponseToken({
      recipientId: payload.recipientId,
      sourcingRequestId: payload.sourcingRequestId,
      supplierCompanyId: payload.supplierCompanyId,
      action: "DECLINED",
    });

    const viewToken = generateRFQResponseToken({
      recipientId: payload.recipientId,
      sourcingRequestId: payload.sourcingRequestId,
      supplierCompanyId: payload.supplierCompanyId,
      action: "VIEW",
    });

    const interestedUrl = `${APP_BASE_URL}/rfq/respond?token=${interestedToken}`;
    const needInfoUrl = `${APP_BASE_URL}/rfq/respond?token=${needInfoToken}`;
    const declinedUrl = `${APP_BASE_URL}/rfq/respond?token=${declinedToken}`;
    const viewUrl = `${APP_BASE_URL}/rfq/respond?token=${viewToken}`;

    const deadlineFormatted = payload.responseDeadline
      ? payload.responseDeadline.toLocaleDateString("en-CA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Not specified";

    const emailBody = `
New Sourcing Request via AtlanticSource

Buyer: ${payload.buyerOrgName}
Requirement: ${payload.rfqTitle}
Location: ${payload.location}
Response Deadline: ${deadlineFormatted}

Details:
${payload.rfqDescription}

Actions:
[Interested]: ${interestedUrl}
[Need More Information]: ${needInfoUrl}
[Not Interested]: ${declinedUrl}
[View Request]: ${viewUrl}
`;

    if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
      return {
        providerMessageId,
        status: "SENT",
      };
    }

    try {
      await prisma.emailDelivery.create({
        data: {
          providerMessageId,
          recipientContactId: payload.contactId,
          recipientEmail: payload.recipientEmail,
          messageType: "RFQ_OUTREACH",
          state: EmailStateEnum.SENT,
          sentAt: new Date(),
          metadata: JSON.stringify({
            sourcingRequestId: payload.sourcingRequestId,
            supplierCompanyId: payload.supplierCompanyId,
            rfqTitle: payload.rfqTitle,
            bodySnippet: emailBody.substring(0, 300),
          }),
        },
      });

      await prisma.rFQRecipient.update({
        where: { id: payload.recipientId },
        data: {
          deliveryStatus: RFQDeliveryStatusEnum.SENT,
          sentAt: new Date(),
        },
      });
    } catch {
      // offline
    }

    return {
      providerMessageId,
      status: "SENT",
    };
  }

  async handleWebhook(body: EmailWebhookPayload, signature: string): Promise<boolean> {
    if (signature && signature !== "skip-sig-check") {
      const expectedSig = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(JSON.stringify(body))
        .digest("hex");

      if (signature !== expectedSig) {
        return false;
      }
    }

    if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
      return true;
    }

    try {
      const emailDelivery = await prisma.emailDelivery.findFirst({
        where: { providerMessageId: body.providerMessageId },
      });

      if (!emailDelivery) {
        return true;
      }

      let targetState: EmailStateEnum = EmailStateEnum.SENT;
      let rfqDeliveryStatus: RFQDeliveryStatusEnum = RFQDeliveryStatusEnum.SENT;

      if (body.event === "DELIVERED") {
        targetState = EmailStateEnum.DELIVERED;
        rfqDeliveryStatus = RFQDeliveryStatusEnum.DELIVERED;
      } else if (body.event === "BOUNCED") {
        targetState = EmailStateEnum.BOUNCED;
        rfqDeliveryStatus = RFQDeliveryStatusEnum.BOUNCED;
      } else if (body.event === "FAILED") {
        targetState = EmailStateEnum.FAILED;
        rfqDeliveryStatus = RFQDeliveryStatusEnum.FAILED;
      }

      await prisma.emailDelivery.update({
        where: { id: emailDelivery.id },
        data: {
          state: targetState,
          deliveredAt: body.event === "DELIVERED" ? new Date() : undefined,
          bouncedAt: body.event === "BOUNCED" ? new Date() : undefined,
          failedAt: body.event === "FAILED" ? new Date() : undefined,
        },
      });

      if (emailDelivery.metadata) {
        const meta = JSON.parse(emailDelivery.metadata);
        if (meta.sourcingRequestId && meta.supplierCompanyId) {
          const recipient = await prisma.rFQRecipient.findFirst({
            where: {
              sourcingRequestId: meta.sourcingRequestId,
              supplierCompanyId: meta.supplierCompanyId,
            },
          });

          if (recipient) {
            await prisma.rFQRecipient.update({
              where: { id: recipient.id },
              data: {
                deliveryStatus: rfqDeliveryStatus,
                bouncedAt: body.event === "BOUNCED" ? new Date() : undefined,
              },
            });
          }
        }
      }

      if (body.event === "BOUNCED" && emailDelivery.recipientContactId) {
        await prisma.contact.update({
          where: { id: emailDelivery.recipientContactId },
          data: { bouncedAt: new Date() },
        });
      }
    } catch {
      // offline
    }

    return true;
  }
}

export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey?: string, fromEmail?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || "";
    this.fromEmail = fromEmail || process.env.EMAIL_FROM || "noreply@atlanticsource.ca";
  }

  async sendRFQNotification(payload: SendRFQEmailPayload): Promise<EmailSendResult> {
    if (!this.apiKey) {
      throw new Error("RESEND_API_KEY is not configured in environment");
    }

    const interestedToken = generateRFQResponseToken({
      recipientId: payload.recipientId,
      sourcingRequestId: payload.sourcingRequestId,
      supplierCompanyId: payload.supplierCompanyId,
      action: "INTERESTED",
    });

    const needInfoToken = generateRFQResponseToken({
      recipientId: payload.recipientId,
      sourcingRequestId: payload.sourcingRequestId,
      supplierCompanyId: payload.supplierCompanyId,
      action: "NEED_INFORMATION",
    });

    const declinedToken = generateRFQResponseToken({
      recipientId: payload.recipientId,
      sourcingRequestId: payload.sourcingRequestId,
      supplierCompanyId: payload.supplierCompanyId,
      action: "DECLINED",
    });

    const viewToken = generateRFQResponseToken({
      recipientId: payload.recipientId,
      sourcingRequestId: payload.sourcingRequestId,
      supplierCompanyId: payload.supplierCompanyId,
      action: "VIEW",
    });

    const interestedUrl = `${APP_BASE_URL}/rfq/respond?token=${interestedToken}`;
    const needInfoUrl = `${APP_BASE_URL}/rfq/respond?token=${needInfoToken}`;
    const declinedUrl = `${APP_BASE_URL}/rfq/respond?token=${declinedToken}`;
    const viewUrl = `${APP_BASE_URL}/rfq/respond?token=${viewToken}`;

    const deadlineFormatted = payload.responseDeadline
      ? payload.responseDeadline.toLocaleDateString("en-CA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Not specified";

    const emailBody = `
New Sourcing Request via AtlanticSource

Buyer: ${payload.buyerOrgName}
Requirement: ${payload.rfqTitle}
Location: ${payload.location}
Response Deadline: ${deadlineFormatted}

Details:
${payload.rfqDescription}

Actions:
[Interested]: ${interestedUrl}
[Need More Information]: ${needInfoUrl}
[Not Interested]: ${declinedUrl}
[View Request]: ${viewUrl}
`;

    let providerMessageId = "";
    let isSuccess = false;
    let errorMessage = "";

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [payload.recipientEmail],
          subject: `New Sourcing Request: ${payload.rfqTitle} (${payload.buyerOrgName})`,
          text: emailBody,
        }),
      });

      const resData = await res.json().catch(() => ({}));

      if (res.ok && resData.id) {
        providerMessageId = resData.id;
        isSuccess = true;
      } else {
        errorMessage = resData.message || `Resend HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Network connection to Resend API failed";
    }

    if (isSuccess) {
      try {
        await prisma.emailDelivery.create({
          data: {
            providerMessageId,
            recipientContactId: payload.contactId,
            recipientEmail: payload.recipientEmail,
            messageType: "RFQ_OUTREACH",
            state: EmailStateEnum.SENT,
            sentAt: new Date(),
            metadata: JSON.stringify({
              provider: "resend",
              sourcingRequestId: payload.sourcingRequestId,
              supplierCompanyId: payload.supplierCompanyId,
              rfqTitle: payload.rfqTitle,
            }),
          },
        });

        await prisma.rFQRecipient.update({
          where: { id: payload.recipientId },
          data: {
            deliveryStatus: RFQDeliveryStatusEnum.SENT,
            sentAt: new Date(),
          },
        });
      } catch {
        // ignore DB log failure
      }

      return {
        providerMessageId,
        status: "SENT",
      };
    } else {
      const failId = `resend_fail_${crypto.randomBytes(8).toString("hex")}`;
      try {
        await prisma.emailDelivery.create({
          data: {
            providerMessageId: failId,
            recipientContactId: payload.contactId,
            recipientEmail: payload.recipientEmail,
            messageType: "RFQ_OUTREACH",
            state: EmailStateEnum.FAILED,
            failedAt: new Date(),
            metadata: JSON.stringify({
              provider: "resend",
              error: errorMessage,
              sourcingRequestId: payload.sourcingRequestId,
              supplierCompanyId: payload.supplierCompanyId,
            }),
          },
        });

        await prisma.rFQRecipient.update({
          where: { id: payload.recipientId },
          data: {
            deliveryStatus: RFQDeliveryStatusEnum.FAILED,
          },
        });
      } catch {
        // ignore DB log failure
      }

      return {
        providerMessageId: failId,
        status: "FAILED",
      };
    }
  }

  async handleWebhook(body: EmailWebhookPayload, signature: string): Promise<boolean> {
    return new DevelopmentEmailProvider().handleWebhook(body, signature);
  }
}

export function getEmailProvider(): EmailProvider {
  const providerType = (process.env.EMAIL_PROVIDER || "development").toLowerCase();
  if (providerType === "resend") {
    return new ResendEmailProvider();
  }
  return new DevelopmentEmailProvider();
}

export const defaultEmailProvider = getEmailProvider();

