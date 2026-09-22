import { z } from "zod";
import { ClaimValidator, ValidationInput, ValidationResult } from "./types";
import { evaluateDeterministicRules } from "./rulesEngine";
import { logger } from "@/lib/logger";

export const ValidationResultSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "HUMAN_REVIEW"]),
  confidence: z.number().min(0).max(1),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  reason: z.string(),
  evidenceSupported: z.boolean(),
});

export class HeuristicClaimValidator implements ClaimValidator {
  name = "AtlanticSourceClaimValidator";
  version = "1.0.0";

  async validateClaim(input: ValidationInput): Promise<ValidationResult> {
    try {
      // 1. Run Deterministic Rules Engine
      const ruleResult = evaluateDeterministicRules(input);

      // Validate output structure with Zod
      const parsed = ValidationResultSchema.safeParse({
        decision: ruleResult.decision,
        confidence: ruleResult.confidence,
        risk: ruleResult.risk,
        reason: ruleResult.reason,
        evidenceSupported: ruleResult.evidenceSupported,
      });

      if (!parsed.success) {
        logger.warn({ errors: parsed.error.format(), claimId: input.claimId }, "Validator output schema mismatch, failing safely to HUMAN_REVIEW");
        return {
          decision: "HUMAN_REVIEW",
          confidence: 0.0,
          risk: "HIGH",
          reason: "Validation output format failure, routed to human review",
          evidenceSupported: false,
          validatorVersion: this.version,
          validatorActor: `${this.name}:SAFE_FALLBACK`,
        };
      }

      return ruleResult;
    } catch (err: unknown) {
      logger.error({ err, claimId: input.claimId }, "Unexpected error in ClaimValidator, failing safely to HUMAN_REVIEW");
      return {
        decision: "HUMAN_REVIEW",
        confidence: 0.0,
        risk: "HIGH",
        reason: `Validation exception: ${err instanceof Error ? err.message : "Internal error"}, routed to human review`,
        evidenceSupported: false,
        validatorVersion: this.version,
        validatorActor: `${this.name}:SAFE_FALLBACK`,
      };
    }
  }

  async validateBatch(inputs: ValidationInput[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    for (const input of inputs) {
      results.push(await this.validateClaim(input));
    }
    return results;
  }
}

export const defaultClaimValidator = new HeuristicClaimValidator();
