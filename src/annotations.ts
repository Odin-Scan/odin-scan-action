import * as core from '@actions/core';
import type { Finding } from './types';

/**
 * Emits GitHub workflow annotations for security findings.
 *
 * Critical and high findings produce error annotations (which appear
 * as red markers in the GitHub UI). Medium and below produce warnings.
 * Likely false positives are skipped entirely.
 */
export function emitAnnotations(findings: Finding[]): void {
  for (const finding of findings) {
    if (finding.isLikelyFalsePositive) continue;

    const props: core.AnnotationProperties = {};

    if (finding.location?.file) {
      props.file = finding.location.file;
      if (finding.location.startLine) {
        props.startLine = finding.location.startLine;
      }
      if (finding.location.endLine) {
        props.endLine = finding.location.endLine;
      }
    }

    props.title = `[${finding.severity.toUpperCase()}] ${finding.title}`;

    const message = finding.remediation
      ? `${finding.description}\n\nRemediation: ${finding.remediation}`
      : finding.description;

    if (finding.severity === 'critical' || finding.severity === 'high') {
      core.error(message, props);
    } else {
      core.warning(message, props);
    }
  }
}
