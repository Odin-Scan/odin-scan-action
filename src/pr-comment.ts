import * as core from '@actions/core';
import * as github from '@actions/github';
import type { AnalysisResult, FindingsVisibility, Severity } from './types';

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

/** Appends branch and commit metadata to the comment body. */
function appendBranchInfo(body: string, result: AnalysisResult): string {
  if (!result.branch) return body;
  let line = `**Branch:** \`${result.branch}\``;
  if (result.commitHash) line += ` (\`${result.commitHash.substring(0, 7)}\`)`;
  return body + line + `\n`;
}

/** Builds the severity counts table. */
function buildSeverityTable(summary: AnalysisResult['summary']): string {
  let table = `| Severity | Count |\n`;
  table += `|----------|-------|\n`;
  if (summary.criticalFindings > 0) table += `| 🔴 Critical | ${summary.criticalFindings} |\n`;
  if (summary.highFindings > 0) table += `| 🟠 High | ${summary.highFindings} |\n`;
  if (summary.mediumFindings > 0) table += `| 🟡 Medium | ${summary.mediumFindings} |\n`;
  if (summary.lowFindings > 0) table += `| 🟢 Low | ${summary.lowFindings} |\n`;
  if (summary.informationalFindings > 0) table += `| 🔵 Info | ${summary.informationalFindings} |\n`;
  return table + `\n`;
}

/**
 * Formats a full-detail PR comment with severity table and top findings.
 *
 * Includes finding titles, file locations, descriptions, and remediation hints.
 * Suitable for private repositories or contexts where disclosure is acceptable.
 */
function formatFull(result: AnalysisResult, reportUrl: string): string {
  const { summary } = result;
  const totalReal = summary.totalFindings - (summary.falsePositiveCount || 0);

  let body = `## 🛡️ Odin Scan Security Analysis\n\n`;

  if (totalReal === 0) {
    body += `✅ **No security findings detected.**\n\n`;
  } else {
    body += buildSeverityTable(summary);

    // Prefer Critical/High findings; fall back to Medium if none exist
    const severityOrder: Record<string, number> = { critical: 3, high: 2, medium: 1 };
    let topFindings = result.findings
      .filter(f => f.severity === 'critical' || f.severity === 'high')
      .sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));

    if (topFindings.length === 0) {
      topFindings = result.findings
        .filter(f => f.severity === 'medium')
        .sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
    }

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

        body += `${emoji} **[${f.severity.toUpperCase()}]** ${f.title}\n`;
        if (loc) body += `> 📍 ${loc}\n`;
        if (f.description) body += `> ${truncate(f.description, DESC_MAX_LEN)}\n`;
        if (f.remediation) body += `> 💡 ${truncate(f.remediation, DESC_MAX_LEN)}\n`;
        body += `\n`;
      }
    }
  }

  body = appendBranchInfo(body, result);
  body += `\nTo see the full report, go to [View full report](${reportUrl}) | Powered by [Odin Scan](https://odinscan.ai)\n`;
  return body;
}

/**
 * Formats a counts-only PR comment with the severity table but no finding details.
 *
 * Omits titles, file paths, descriptions, and remediation to avoid leaking
 * exploitable vulnerability details on public repositories.
 */
function formatCounts(result: AnalysisResult, reportUrl: string): string {
  const { summary } = result;
  const totalReal = summary.totalFindings - (summary.falsePositiveCount || 0);

  let body = `## 🛡️ Odin Scan Security Analysis\n\n`;

  if (totalReal === 0) {
    body += `✅ **No security findings detected.**\n\n`;
  } else {
    body += buildSeverityTable(summary);
  }

  body = appendBranchInfo(body, result);
  body += `\n[View full report](${reportUrl}) | Powered by [Odin Scan](https://odinscan.ai)\n`;
  return body;
}

/**
 * Formats a private PR comment that reveals no finding details or counts.
 *
 * Only indicates whether findings exist and links to the login-protected
 * report dashboard. Designed for public repositories with production code
 * where any disclosure creates an exploitable attack window.
 */
function formatPrivate(result: AnalysisResult, reportUrl: string): string {
  const { summary } = result;
  const totalReal = summary.totalFindings - (summary.falsePositiveCount || 0);

  let body = `## 🛡️ Odin Scan Security Analysis\n\n`;

  if (totalReal === 0) {
    body += `✅ **Security analysis complete.**\n\n`;
  } else {
    body += `⚠️ **Security findings were detected that require attention before merging.**\n\n`;
  }

  body = appendBranchInfo(body, result);
  body += `\nDetails are restricted to authorized reviewers. [View private report](${reportUrl}) | Powered by [Odin Scan](https://odinscan.ai)\n`;
  return body;
}

/**
 * Formats the PR comment body from analysis results.
 *
 * Delegates to mode-specific formatters based on the findings visibility level:
 * - `full`: severity table + top findings with details (titles, locations, descriptions)
 * - `counts`: severity table only, no finding details
 * - `private`: no counts or details, just a link to the private report
 */
function formatComment(result: AnalysisResult, reportUrl: string, mode: FindingsVisibility): string {
  switch (mode) {
    case 'counts':
      return formatCounts(result, reportUrl);
    case 'private':
      return formatPrivate(result, reportUrl);
    default:
      return formatFull(result, reportUrl);
  }
}

/**
 * Creates a new PR comment with analysis results.
 *
 * Posts a fresh comment on each run so every commit gets its own
 * security summary visible in the PR timeline. No-ops if the
 * current context is not a pull request. The visibility mode controls
 * how much finding detail is included in the comment.
 */
export async function postPrComment(
  result: AnalysisResult,
  reportUrl: string,
  githubToken: string,
  mode: FindingsVisibility = 'full',
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
  const body = formatComment(result, reportUrl, mode);

  core.info(`Creating new PR comment (visibility: ${mode})`);
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}
