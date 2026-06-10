export type DispatcherRoute = 'code_review' | 'incident' | 'analytics' | 'needs_human';

export interface DispatcherInputSummary {
  id: string;
  title: string;
  kind: DispatcherRoute;
  fileName: string;
  preview: string;
}

export interface DispatcherRunRequest {
  inputId?: string;
  content?: string;
}

export interface DispatcherClassification {
  route: DispatcherRoute;
  confidence: number;
  reasoning: string;
}

export interface DispatcherTraceStep {
  node: string;
  title: string;
  detail: string;
}

export interface ReviewReport {
  axis: string;
  risk: 'low' | 'medium' | 'high';
  finding: string;
  recommendation: string;
}

export interface ReviewVerdict {
  verdict: 'approve' | 'changes_requested' | 'block';
  reason: string;
}

export interface AnalyticsTask {
  metric: string;
  segment: string;
  rationale: string;
}

export interface AnalyticsFinding {
  metric: string;
  segment: string;
  result: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface DispatcherRunResponse {
  inputId: string;
  inputTitle: string;
  classification?: DispatcherClassification;
  route?: DispatcherRoute;
  finalAnswer: string;
  reviewReports: ReviewReport[];
  reviewVerdict?: ReviewVerdict;
  analyticsTasks: AnalyticsTask[];
  analyticsFindings: AnalyticsFinding[];
  trace: DispatcherTraceStep[];
}

export interface DispatcherGraphResponse {
  mermaid: string;
}
