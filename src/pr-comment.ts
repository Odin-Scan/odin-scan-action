import * as core from '@actions/core';
import * as github from '@actions/github';
import type { AnalysisResult, Severity } from './types';

/** HTML comment marker used to identify and upsert Odin Scan PR comments. */
const COMMENT_MARKER = '<!-- odin-scan-report -->';

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
 * lists the top 5 most severe findings with description and location,
 * and links to the full report.
 */
function formatComment(result: AnalysisResult, reportUrl: string): string {
  const { summary } = result;
  const totalReal = summary.totalFindings - (summary.falsePositiveCount || 0);

  let body = `${COMMENT_MARKER}\n`;
  body += `## 🛡️ Odin Scan Security Analysis\n\n`;

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

    // Show top 5 findings sorted by severity (highest first)
    const severityOrder: Record<string, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      informational: 1,
    };

    const topFindings = result.findings
      .filter(f => !f.isLikelyFalsePositive)
      .sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0))
      .slice(0, 5);

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
 * Creates or updates the PR comment with analysis results.
 *
 * Uses a hidden HTML comment marker to find and update an existing
 * comment, avoiding duplicate comments on re-runs. No-ops if the
 * current context is not a pull request.
 */
export async function upsertPrComment(
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

  // Search for an existing Odin Scan comment to update
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  const existing = comments.find(c => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    core.info(`Updating existing PR comment #${existing.id}`);
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    core.info('Creating new PR comment');
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}
