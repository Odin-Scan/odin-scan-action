# Privacy Policy - Odin Scan GitHub Action

**Last Updated:** February 17, 2026

## Overview

The Odin Scan GitHub Action is a free, open-source integration tool that connects your GitHub repository to the Odin Scan API for smart contract security analysis. This document explains what data the action accesses and how it's used.

## What Data Does This Action Access?

The action accesses the following information from your GitHub workflow environment:

1. **Repository Information**
   - Repository URL (e.g., `https://github.com/owner/repo`)
   - Repository name
   - Branch name
   - Commit SHA

2. **Source Code**
   - Your repository's source code is cloned and analyzed by the Odin Scan API
   - Only the branch/commit specified in your workflow is accessed

3. **GitHub Token** (Optional)
   - If provided via the `github-token` input, used only for:
     - Posting PR comments (requires `pull-requests: write` permission)
     - Uploading SARIF to Code Scanning (requires `security-events: write` permission)
     - Cloning private repositories for analysis
   - The token is never logged or stored by the action

4. **API Key**
   - Your Odin Scan API key (`odin_sk_*`) is used to authenticate with the Odin Scan API
   - Transmitted securely via HTTPS
   - Automatically masked in GitHub Actions logs

## How Is This Data Used?

### Data Sent to Odin Scan API

The action sends the following to `api.odinscan.ai`:

- Repository URL, name, branch, and commit SHA
- Your source code (for security analysis)
- Analysis configuration (platform, severity threshold)
- GitHub token (only if you provide `externalGithubToken` and authenticate with an API key)

This data is processed according to the [Odin Scan Privacy Policy](https://odinscan.ai/privacy).

### Data Processed Locally (GitHub Runner)

The following operations occur entirely within your GitHub Actions runner:

- Generating SARIF reports from API results
- Formatting PR comments
- Creating workflow annotations
- Uploading artifacts

**No data from these operations is sent to third parties.**

## Data Retention

### By This Action
The action itself does **not store or retain any data**. It is a stateless workflow orchestrator.

### By Odin Scan API
Analysis results, findings, and repository metadata are stored according to your Odin Scan subscription plan. See the [Odin Scan Privacy Policy](https://odinscan.ai/privacy) for details.

### By GitHub
- Workflow logs (including action output) are retained according to [GitHub's retention policies](https://docs.github.com/en/actions/learn-github-actions/usage-limits-billing-and-administration)
- SARIF uploads are stored in GitHub Code Scanning
- Artifacts are retained per your repository settings (default: 90 days)

## Third-Party Services

This action communicates with:

1. **Odin Scan API** (`api.odinscan.ai`)
   - Purpose: Smart contract security analysis
   - Privacy Policy: https://odinscan.ai/privacy
   - Data shared: Repository URL, source code, analysis configuration

2. **GitHub API** (via `@actions/github`)
   - Purpose: PR comments, SARIF upload, repository access
   - Privacy Policy: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement
   - Data shared: Controlled by workflow permissions

## Data Security

- All API communication uses HTTPS (TLS 1.2+)
- API keys are masked in logs via `core.setSecret()`
- No credentials are logged or stored by the action
- GitHub tokens are only used within the workflow runner environment

## Your Rights

### Control Over Data Collection
You control what data is sent by:
- Choosing which repositories to scan
- Configuring workflow triggers (e.g., only on PRs, specific branches)
- Providing or withholding optional inputs (e.g., `github-token`)

### Access and Deletion
- **Analysis results**: Managed through your Odin Scan account at https://app.odinscan.ai
- **Workflow logs**: Managed through your GitHub repository settings
- **SARIF data**: Managed through GitHub Code Scanning settings

## Children's Privacy

This action is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date above. Continued use of the action after changes constitutes acceptance.

## Contact

For privacy-related questions or concerns:

- **Odin Scan Support:** support@odinscan.ai
- **Action Issues:** https://github.com/Odin-Scan/odin-scan-action/issues

## Compliance

This action and the Odin Scan service comply with:

- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- GitHub Marketplace Developer Agreement
- GitHub Terms of Service

For details on Odin Scan's compliance certifications, see https://odinscan.ai/security.
