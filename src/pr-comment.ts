import * as core from '@actions/core';
import * as github from '@actions/github';
import type { AnalysisResult, Severity } from './types';

/** Emoji for each severity level, matching the markdown report convention. */
const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
  informational: '🔵',
};

/** Maximum characters to show from a finding description before truncating. */
const DESC_MAX_LEN = 200;

/**
 * Truncates a string to `maxLen` characters, appending "…" if cut.
 *
 * Avoids splitting mid-word by breaking at the last space within the limit.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.lastIndexOf(' ', maxLen);
  return `${text.slice(0, cut > 0 ? cut : maxLen)}…`;
}

/**
 * Formats the PR comment body from analysis results.
 *
 * Produces a markdown table of finding counts by severity,
 * lists Critical and High findings with description and location,
 * and links to the full report.
 */
function formatComment(result: AnalysisResult, reportUrl: string): string {
  const { summary } = result;
  const totalReal = summary.totalFindings - (summary.falsePositiveCount || 0);

  let body = `## 🛡️ Odin Scan Security Analysis\n\n`;

  if (totalReal === 0) {
    body += `✅ **No security findings detected.**\n\n`;
  } else {
    body += `| Severity | Count |\n`;
    body += `|----------|-------|\n`;
    if (summary.criticalFindings > 0) body += `| 🔴 Critical | ${summary.criticalFindings} |\n`;
    if (summary.highFindings > 0) body += `| 🟠 High | ${summary.highFindings} |\n`;
    if (summary.mediumFindings > 0) body += `| 🟡 Medium | ${summary.mediumFindings} |\n`;
    if (summary.lowFindings > 0) body += `| 🟢 Low | ${summary.lowFindings} |\n`;
    if (summary.informationalFindings > 0) body += `| 🔵 Info | ${summary.informationalFindings} |\n`;
    body += `\n`;

    // Show only Critical and High findings (most actionable for PR review)
    const topFindings = result.findings
      .filter(f => !f.isLikelyFalsePositive && (f.severity === 'critical' || f.severity === 'high'))
      .sort((a, b) => (a.severity === 'critical' ? -1 : 1));

    if (topFindings.length > 0) {
      body += `### Top Findings\n\n`;
      for (const f of topFindings) {
        const emoji = SEVERITY_EMOJI[f.severity] ?? '⚪';
        const loc = f.location?.file
          ? (() => {
              const lines = f.location.startLine
                ? f.location.endLine && f.location.endLine !== f.location.startLine
                  ? `L${f.location.startLine}-L${f.location.endLine}`
                  : `L${f.location.startLine}`
                : '';
              return `\`${f.location.file}${lines ? `:${lines}` : ''}\``;
            })()
          : null;

        body += `#### ${emoji} **[${f.severity.toUpperCase()}]** ${f.title}\n`;
        if (loc) body += `> 📍 ${loc}\n`;
        if (f.description) body += `>\n> ${truncate(f.description, DESC_MAX_LEN)}\n`;
        body += `\n`;
      }
    }
  }

  if (result.branch) {
    body += `**Branch:** \`${result.branch}\``;
    if (result.commitHash) body += ` (\`${result.commitHash.substring(0, 7)}\`)`;
    body += `\n`;
  }

  body += `\n[View full report](${reportUrl}) | Powered by [Odin Scan](https://odinscan.ai)\n`;

  return body;
}

/**
 * Creates a new PR comment with analysis results.
 *
 * Posts a fresh comment on each run so every commit gets its own
 * security summary visible in the PR timeline. No-ops if the
 * current context is not a pull request.
 */
export async function postPrComment(
  result: AnalysisResult,
  reportUrl: string,
  githubToken: string,
): Promise<void> {
  const context = github.context;

  if (!context.payload.pull_request) {
    core.info('Not a pull request -- skipping PR comment');
    return;
  }

  const octokit = github.getOctokit(githubToken);
  const issueNumber = context.payload.pull_request.number;
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const body = formatComment(result, reportUrl);

  core.info('Creating new PR comment');
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}
