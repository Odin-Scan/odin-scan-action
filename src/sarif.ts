import type { AnalysisResult, Severity } from './types';

/**
 * Maps an Odin Scan severity to the SARIF result level.
 *
 * SARIF supports three levels: error, warning, and note.
 * Critical and high map to error, medium maps to warning,
 * and low/informational map to note.
 */
function mapSeverityToSarif(severity: Severity): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    case 'informational':
    default:
      return 'note';
  }
}

/**
 * Generates a SARIF 2.1.0 report from analysis results.
 *
 * Filters out likely false positives, deduplicates rules by category,
 * and maps findings to SARIF result objects with location and remediation info.
 */
export function generateSarif(result: AnalysisResult): object {
  const findings = result.findings.filter(f => !f.isLikelyFalsePositive);

  // Build unique rules from finding categories
  const rulesMap = new Map<string, {
    id: string;
    shortDescription: string;
    fullDescription: string;
    defaultLevel: string;
  }>();

  for (const finding of findings) {
    const ruleId = finding.category || finding.id;
    if (!rulesMap.has(ruleId)) {
      rulesMap.set(ruleId, {
        id: ruleId,
        shortDescription: finding.title,
        fullDescription: finding.description,
        defaultLevel: mapSeverityToSarif(finding.severity),
      });
    }
  }

  const rules = Array.from(rulesMap.values()).map(rule => ({
    id: rule.id,
    shortDescription: { text: rule.shortDescription },
    fullDescription: { text: rule.fullDescription },
    defaultConfiguration: { level: rule.defaultLevel },
  }));

  // Build SARIF results from findings
  const results = findings.map(finding => {
    const sarifResult: Record<string, unknown> = {
      ruleId: finding.category || finding.id,
      level: mapSeverityToSarif(finding.severity),
      message: { text: finding.description },
      fingerprints: { 'odinScanId': finding.id },
    };

    if (finding.location?.file) {
      sarifResult.locations = [{
        physicalLocation: {
          artifactLocation: { uri: finding.location.file },
          region: {
            startLine: finding.location.startLine || 1,
            ...(finding.location.endLine ? { endLine: finding.location.endLine } : {}),
          },
        },
      }];
    }

    if (finding.remediation) {
      sarifResult.fixes = [{
        description: { text: finding.remediation },
      }];
    }

    return sarifResult;
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'Odin Scan',
          informationUri: 'https://odinscan.ai',
          version: '1.0.0',
          rules,
        },
      },
      results,
    }],
  };
}
