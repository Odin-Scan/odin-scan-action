import * as core from '@actions/core';
import * as github from '@actions/github';

/** Resolved PR metadata from the GitHub API. */
export interface PullRequestInfo {
  /** PR number. */
  number: number;
  /** Head branch name (e.g., "feature/xyz"). */
  headRef: string;
  /** HEAD commit SHA of the PR branch. */
  headSha: string;
}

/**
 * Determines whether the current workflow run is a comment-triggered scan.
 *
 * Returns `true` only when all conditions are met:
 * 1. Event is `issue_comment` with action `created`
 * 2. Comment is on a pull request (not a plain issue)
 * 3. Sender is not a bot (prevents infinite loops)
 * 4. Comment body contains the trigger phrase (case-insensitive)
 *
 * Also matches `/odin-scan` when trigger phrase is `@odin-scan` (and vice-versa).
 */
export function isCommentTrigger(triggerPhrase: string): boolean {
  const context = github.context;

  if (context.eventName !== 'issue_comment') return false;
  if (context.payload.action !== 'created') return false;
  if (!context.payload.issue?.pull_request) return false;
  if (context.payload.sender?.type === 'Bot') return false;

  const body = (context.payload.comment?.body ?? '').toLowerCase();
  const phrase = triggerPhrase.toLowerCase();

  if (body.includes(phrase)) return true;

  // Allow `/odin-scan` as alias for `@odin-scan` and vice-versa
  const altPhrase = phrase.startsWith('@')
    ? '/' + phrase.slice(1)
    : phrase.startsWith('/')
      ? '@' + phrase.slice(1)
      : null;

  return altPhrase !== null && body.includes(altPhrase);
}

/**
 * Fetches the PR head ref and SHA from the GitHub API.
 *
 * Required because `issue_comment` events set `context.sha` and `context.ref`
 * to the default branch, not the PR branch.
 */
export async function fetchPullRequestInfo(githubToken: string): Promise<PullRequestInfo> {
  const context = github.context;
  const octokit = github.getOctokit(githubToken);

  const { data: pr } = await octokit.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.issue!.number,
  });

  return {
    number: pr.number,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
  };
}

/**
 * Adds a rocket reaction to the trigger comment as visual acknowledgment.
 *
 * Catches and warns on failure so the scan continues even if the reaction
 * permission is denied.
 */
export async function acknowledgeComment(githubToken: string): Promise<void> {
  const context = github.context;

  try {
    const octokit = github.getOctokit(githubToken);
    await octokit.rest.reactions.createForIssueComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: context.payload.comment!.id,
      content: 'rocket',
    });
  } catch (err) {
    core.warning(
      `Failed to add reaction to comment: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
