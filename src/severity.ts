import type { Severity, ThresholdLevel, AnalysisResult } from './types';

/** Numeric severity ordering for comparison. Higher values are more severe. */
const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

/** Maps threshold levels to the minimum numeric severity that triggers failure. */
const THRESHOLD_MAP: Record<ThresholdLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  none: 0,
};

/**
 * Checks if any findings exceed the severity threshold.
 *
 * Excludes likely false positives from the check. Returns true
 * if at least one non-FP finding meets or exceeds the threshold.
 */
export function exceedsThreshold(result: AnalysisResult, threshold: ThresholdLevel): boolean {
  if (threshold === 'none') return false;

  const minSeverity = THRESHOLD_MAP[threshold];

  return result.findings
    .filter(f => !f.isLikelyFalsePositive)
    .some(f => (SEVERITY_ORDER[f.severity] || 0) >= minSeverity);
}

/**
 * Counts findings at or above the threshold severity.
 *
 * Excludes likely false positives from the count.
 */
export function countFindingsAboveThreshold(result: AnalysisResult, threshold: ThresholdLevel): number {
  if (threshold === 'none') return 0;

  const minSeverity = THRESHOLD_MAP[threshold];

  return result.findings
    .filter(f => !f.isLikelyFalsePositive)
    .filter(f => (SEVERITY_ORDER[f.severity] || 0) >= minSeverity)
    .length;
}
