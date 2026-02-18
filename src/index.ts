import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { DefaultArtifactClient } from '@actions/artifact';
import { OdinScanClient } from './api-client';
import { generateSarif } from './sarif';
import { emitAnnotations } from './annotations';
import { upsertPrComment } from './pr-comment';
import { exceedsThreshold, countFindingsAboveThreshold } from './severity';
import type { ActionConfig, Platform, ThresholdLevel } from './types';

/** Parses and validates action inputs from the workflow configuration. */
function parseInputs(): ActionConfig {
  const apiKey = core.getInput('api-key', { required: true });
  core.setSecret(apiKey);

  return {
    apiKey,
    apiUrl: core.getInput('api-url') || 'https://api.odinscan.ai',
    platform: (core.getInput('platform') || 'auto') as Platform,
    severityThreshold: (core.getInput('severity-threshold') || 'high') as ThresholdLevel,
    failOnFindings: core.getBooleanInput('fail-on-findings'),
    commentOnPr: core.getBooleanInput('comment-on-pr'),
    uploadSarif: core.getBooleanInput('upload-sarif'),
    uploadArtifact: core.getBooleanInput('upload-artifact'),
    timeout: parseInt(core.getInput('timeout') || '1800', 10),
    githubToken: core.getInput('github-token') || process.env.GITHUB_TOKEN || '',
  };
}

/**
 * Resolves the contract framework string from the platform input.
 *
 * When set to 'auto', passes through to the API for server-side detection.
 */
function resolveFramework(platform: Platform): string {
  if (platform !== 'auto') return platform;
  return 'auto';
}

/**
 * Polls analysis status until completion or timeout.
 *
 * Uses a stepped backoff strategy: 10s, 15s, 20s, then 30s intervals.
 * Throws on analysis failure or timeout.
 */
async function pollUntilComplete(
  client: OdinScanClient,
  analysisId: string,
  timeoutMs: number,
): Promise<void> {
  const startTime = Date.now();
  const delays = [10000, 15000, 20000, 30000];
  let attempt = 0;

  while (Date.now() - startTime < timeoutMs) {
    const delay = delays[Math.min(attempt, delays.length - 1)];
    await new Promise(resolve => setTimeout(resolve, delay));
    attempt++;

    const status = await client.getAnalysisStatus(analysisId);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const progressInfo = status.progress
      ? ` (${status.progress.percentage}% -- ${status.progress.message})`
      : '';
    core.info(`[${elapsed}s] Status: ${status.status}${progressInfo}`);

    if (status.status === 'completed') return;
    if (status.status === 'failed') {
      throw new Error(`Analysis failed: ${status.error || 'Unknown error'}`);
    }
  }

  throw new Error(`Analysis timed out after ${Math.round(timeoutMs / 1000)} seconds`);
}

/** Main action entry point. Orchestrates the full scan lifecycle. */
async function run(): Promise<void> {
  try {
    const config = parseInputs();
    const client = new OdinScanClient(config.apiUrl, config.apiKey);
    const context = github.context;

    // 1. Validate API key
    core.info('Validating API key...');
    const keyInfo = await client.verifyKey();
    if (!keyInfo.valid) {
      throw new Error('Invalid API key. Please check your ODIN_SCAN_API_KEY secret.');
    }
    core.info(`Authenticated (plan: ${keyInfo.plan})`);

    // 2. Determine repository info
    const repoUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}`;
    const repoName = `${context.repo.owner}/${context.repo.repo}`;
    const branch =
      context.payload.pull_request?.head?.ref ||
      context.ref?.replace('refs/heads/', '') ||
      undefined;
    const framework = resolveFramework(config.platform);

    // 3. Create analysis
    core.info(
      `Creating analysis for ${repoName} (platform: ${framework}, branch: ${branch || 'default'})...`,
    );
    const analysis = await client.createAnalysis({
      repositoryUrl: repoUrl,
      repositoryName: repoName,
      contractFramework: framework,
      branch,
      externalGithubToken: config.githubToken,
    });

    const analysisId = analysis.analysisId;
    core.info(`Analysis created: ${analysisId} (queue position: ${analysis.queuePosition ?? 'N/A'})`);
    core.setOutput('analysis-id', analysisId);

    // 4. Poll until complete
    core.info('Waiting for analysis to complete...');
    await pollUntilComplete(client, analysisId, config.timeout * 1000);

    // 5. Get results
    core.info('Retrieving results...');
    const result = await client.getAnalysisResult(analysisId);
    const { summary } = result;

    core.info(
      `Analysis complete: ${summary.totalFindings} findings ` +
      `(${summary.criticalFindings} critical, ${summary.highFindings} high, ` +
      `${summary.mediumFindings} medium, ${summary.lowFindings} low)`,
    );

    // 6. Set outputs
    core.setOutput('status', 'completed');
    core.setOutput('total-findings', summary.totalFindings.toString());
    core.setOutput('critical-count', summary.criticalFindings.toString());
    core.setOutput('high-count', summary.highFindings.toString());
    core.setOutput('medium-count', summary.mediumFindings.toString());
    core.setOutput('low-count', summary.lowFindings.toString());

    // Strip the "api." subdomain and add the dashboard path prefix.
    // e.g. https://api.staging.odinscan.ai → https://staging.odinscan.ai/dashboard/reports/<id>
    //      https://api.odinscan.ai          → https://odinscan.ai/dashboard/reports/<id>
    const reportUrl = `${config.apiUrl.replace('://api.', '://')}/dashboard/reports/${analysisId}`;
    core.setOutput('report-url', reportUrl);

    // 7. Generate SARIF
    const sarif = generateSarif(result);
    const sarifPath = path.join(process.env.RUNNER_TEMP || '/tmp', 'odin-scan-results.sarif');
    fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2));
    core.setOutput('sarif-file', sarifPath);

    // 8. Upload SARIF to GitHub Code Scanning
    if (config.uploadSarif && config.githubToken) {
      try {
        core.info('Uploading SARIF to GitHub Code Scanning...');
        const octokit = github.getOctokit(config.githubToken);
        const sarifContent = fs.readFileSync(sarifPath, 'utf8');
        const gzipped = zlib.gzipSync(Buffer.from(sarifContent)).toString('base64');

        await octokit.rest.codeScanning.uploadSarif({
          owner: context.repo.owner,
          repo: context.repo.repo,
          commit_sha: context.payload.pull_request?.head?.sha || context.sha,
          ref: context.payload.pull_request?.head?.ref
            ? `refs/heads/${context.payload.pull_request.head.ref}`
            : context.ref,
          sarif: gzipped,
        });
        core.info('SARIF uploaded successfully');
      } catch (err) {
        core.warning(`Failed to upload SARIF: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 9. Emit annotations
    emitAnnotations(result.findings);

    // 10. PR comment
    if (config.commentOnPr && context.payload.pull_request && config.githubToken) {
      try {
        await upsertPrComment(result, reportUrl, config.githubToken);
        core.info('PR comment posted');
      } catch (err) {
        core.warning(
          `Failed to post PR comment: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 11. Upload artifact
    if (config.uploadArtifact) {
      try {
        core.info('Uploading report artifact...');
        const artifactClient = new DefaultArtifactClient();
        const reportPath = path.join(process.env.RUNNER_TEMP || '/tmp', 'odin-scan-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));

        await artifactClient.uploadArtifact(
          'odin-scan-report',
          [reportPath, sarifPath],
          process.env.RUNNER_TEMP || '/tmp',
        );
        core.info('Report artifact uploaded');
      } catch (err) {
        core.warning(
          `Failed to upload artifact: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 12. Check threshold
    if (config.failOnFindings && exceedsThreshold(result, config.severityThreshold)) {
      const count = countFindingsAboveThreshold(result, config.severityThreshold);
      core.setFailed(
        `${count} finding(s) at or above '${config.severityThreshold}' severity threshold`,
      );
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
