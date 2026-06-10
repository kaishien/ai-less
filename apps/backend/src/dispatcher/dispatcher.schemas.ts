import { z } from 'zod';

export const ClassificationSchema = z.object({
  route: z.enum(['code_review', 'incident', 'analytics', 'needs_human']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const ReviewReportSchema = z.object({
  axis: z.string(),
  risk: z.enum(['low', 'medium', 'high']),
  finding: z.string(),
  recommendation: z.string(),
});

export const ReviewVerdictSchema = z.object({
  verdict: z.enum(['approve', 'changes_requested', 'block']),
  reason: z.string(),
});

export const AnalyticsPlanSchema = z.object({
  tasks: z
    .array(
      z.object({
        metric: z.string(),
        segment: z.string(),
        rationale: z.string(),
      }),
    )
    .min(1)
    .max(5),
});

export const AnalyticsFindingSchema = z.object({
  metric: z.string(),
  segment: z.string(),
  result: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
});
