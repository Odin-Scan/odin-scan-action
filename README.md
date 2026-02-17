# Odin Scan GitHub Action

AI-powered smart contract security analysis for CosmWasm, Solana, and EVM projects. Integrates directly into your GitHub workflow to catch vulnerabilities before they reach production.

## Features

- **Multi-platform support** -- CosmWasm, Solana (SVM), and EVM (Solidity/Vyper)
- **Automatic platform detection** -- or specify explicitly
- **GitHub Code Scanning integration** -- uploads SARIF for native security alerts
- **PR comments** -- summary of findings posted directly on pull requests
- **Inline annotations** -- findings appear as errors/warnings on changed files
- **Configurable thresholds** -- fail builds based on severity level
- **Artifact upload** -- full JSON report available as workflow artifact

## Quick Start

```yaml
name: Security Scan
on:
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: odin-scan/odin-scan-action@v1
        with:
          api-key: ${{ secrets.ODIN_SCAN_API_KEY }}
```

## Getting an API Key

1. Visit [Odin Scan Settings](https://app.odinscan.ai/settings)
2. Navigate to **API Keys**
3. Click **Create API Key**
4. Add the key as a repository secret named `ODIN_SCAN_API_KEY`

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | -- | Odin Scan API key (`odin_sk_*`) |
| `platform` | No | `auto` | Target platform: `auto`, `cosmwasm`, `solana`, `evm` |
| `severity-threshold` | No | `high` | Fail at this severity or above: `critical`, `high`, `medium`, `low`, `none` |
| `fail-on-findings` | No | `true` | Whether to fail the workflow when findings exceed threshold |
| `comment-on-pr` | No | `true` | Post summary comment on pull requests |
| `upload-sarif` | No | `true` | Upload SARIF to GitHub Code Scanning |
| `upload-artifact` | No | `true` | Upload full report as workflow artifact |
| `timeout` | No | `1800` | Max wait for analysis completion (seconds) |
| `github-token` | No | `${{ github.token }}` | GitHub token for PR comments and SARIF upload |
| `api-url` | No | `https://api.odinscan.ai` | Odin Scan API base URL |

## Outputs

| Output | Description |
|--------|-------------|
| `analysis-id` | The unique analysis identifier |
| `status` | Analysis status (`completed`, `failed`) |
| `total-findings` | Total number of findings |
| `critical-count` | Number of critical findings |
| `high-count` | Number of high findings |
| `medium-count` | Number of medium findings |
| `low-count` | Number of low findings |
| `report-url` | URL to the full report on Odin Scan |
| `sarif-file` | Path to the generated SARIF file |

## Usage Examples

### Basic (Auto-detect Platform)

```yaml
- uses: odin-scan/odin-scan-action@v1
  with:
    api-key: ${{ secrets.ODIN_SCAN_API_KEY }}
```

### EVM / Solidity

```yaml
- uses: odin-scan/odin-scan-action@v1
  with:
    api-key: ${{ secrets.ODIN_SCAN_API_KEY }}
    platform: evm
    severity-threshold: high
```

### CosmWasm

```yaml
- uses: odin-scan/odin-scan-action@v1
  with:
    api-key: ${{ secrets.ODIN_SCAN_API_KEY }}
    platform: cosmwasm
    severity-threshold: medium
```

### Solana

```yaml
- uses: odin-scan/odin-scan-action@v1
  with:
    api-key: ${{ secrets.ODIN_SCAN_API_KEY }}
    platform: solana
```

### Full Configuration

```yaml
- name: Run Odin Scan
  id: scan
  uses: odin-scan/odin-scan-action@v1
  with:
    api-key: ${{ secrets.ODIN_SCAN_API_KEY }}
    platform: auto
    severity-threshold: medium
    fail-on-findings: true
    comment-on-pr: true
    upload-sarif: true
    upload-artifact: true
    timeout: 1800
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Use outputs
  if: always()
  run: |
    echo "Findings: ${{ steps.scan.outputs.total-findings }}"
    echo "Report: ${{ steps.scan.outputs.report-url }}"
```

### Only on Solidity File Changes

```yaml
on:
  pull_request:
    paths:
      - '**.sol'
      - 'foundry.toml'
      - 'hardhat.config.*'
```

## GitHub Code Scanning (SARIF)

When `upload-sarif` is enabled (default), findings are uploaded to GitHub Code Scanning. This provides:

- Native security alerts in the **Security** tab
- Inline annotations on pull request diffs
- Alert tracking and dismissal workflows
- Integration with GitHub's security overview

**Required permission:**
```yaml
permissions:
  security-events: write
```

Note: GitHub Code Scanning requires GitHub Advanced Security on private repositories.

## Permissions

The action requires these permissions depending on enabled features:

```yaml
permissions:
  contents: read          # Always required (checkout)
  security-events: write  # Required for SARIF upload
  pull-requests: write    # Required for PR comments
```

## Troubleshooting

### "Invalid API key"

Verify the `ODIN_SCAN_API_KEY` secret is set correctly in your repository settings. API keys start with `odin_sk_`.

### "Analysis timed out"

Large repositories may take longer to analyze. Increase the `timeout` input (default is 1800 seconds / 30 minutes).

### "Failed to upload SARIF"

Ensure the workflow has `security-events: write` permission. On private repositories, GitHub Advanced Security must be enabled.

### "Failed to post PR comment"

Ensure the workflow has `pull-requests: write` permission and is triggered by a `pull_request` event.

### Analysis fails immediately

Check that your repository contains supported contract files:
- **EVM**: `.sol` files with Foundry/Hardhat config
- **CosmWasm**: Rust files with `cosmwasm-std` dependency
- **Solana**: Rust files with Anchor or native Solana program structure

## License

MIT
