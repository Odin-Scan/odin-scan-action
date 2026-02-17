/** Severity levels for findings. */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

/** Threshold levels for failing the action. */
export type ThresholdLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

/** Supported target platforms. */
export type Platform = 'auto' | 'cosmwasm' | 'solana' | 'evm';

/** Response from the verify-key endpoint. */
export interface VerifyKeyResponse {
  /** Whether the API key is valid. */
  valid: boolean;
  /** The user ID associated with the key. */
  userId: string;
  /** The plan name (e.g., "pro", "enterprise"). */
  plan: string;
  /** Scopes granted to this key. */
  scopes: string[];
}

/** Response from creating an analysis. */
export interface CreateAnalysisResponse {
  /** The unique analysis identifier. */
  analysisId: string;
  /** Current status of the analysis. */
  status: string;
  /** Human-readable status message. */
  message: string;
  /** Estimated time to completion in seconds. */
  estimatedCompletionTime?: number;
  /** Position in the analysis queue. */
  queuePosition?: number;
}

/** Response from the analysis status endpoint. */
export interface AnalysisStatusResponse {
  /** The analysis identifier. */
  id: string;
  /** Current analysis status. */
  status: 'pending' | 'cloning' | 'analyzing' | 'validating' | 'completed' | 'failed';
  /** Progress details for in-progress analyses. */
  progress?: {
    /** Completion percentage (0-100). */
    percentage: number;
    /** Current pipeline stage. */
    stage: string;
    /** Human-readable progress message. */
    message: string;
  };
  /** Error message if the analysis failed. */
  error?: string;
  /** Total execution time in milliseconds. */
  executionTime?: number;
}

/** A single security finding. */
export interface Finding {
  /** Unique finding identifier. */
  id: string;
  /** Short title describing the finding. */
  title: string;
  /** Detailed description of the vulnerability. */
  description: string;
  /** Severity level of the finding. */
  severity: Severity;
  /** Category or class of the vulnerability (e.g., "reentrancy", "overflow"). */
  category: string;
  /** Source code location of the finding. */
  location?: {
    /** File path relative to the repository root. */
    file: string;
    /** Starting line number. */
    startLine?: number;
    /** Ending line number. */
    endLine?: number;
  };
  /** Suggested fix or mitigation. */
  remediation?: string;
  /** Confidence score (0.0 to 1.0). */
  confidence?: number;
  /** Whether the finding is likely a false positive. */
  isLikelyFalsePositive?: boolean;
  /** External reference URLs. */
  references?: string[];
}

/** Full analysis result from the API. */
export interface AnalysisResult {
  /** The analysis identifier. */
  id: string;
  /** Final analysis status. */
  status: string;
  /** Name of the analyzed repository. */
  repositoryName: string;
  /** URL of the analyzed repository. */
  repositoryUrl: string;
  /** Branch that was analyzed. */
  branch?: string;
  /** Commit hash that was analyzed. */
  commitHash?: string;
  /** List of security findings. */
  findings: Finding[];
  /** Aggregated finding counts by severity. */
  summary: {
    /** Total number of findings across all severities. */
    totalFindings: number;
    /** Number of critical-severity findings. */
    criticalFindings: number;
    /** Number of high-severity findings. */
    highFindings: number;
    /** Number of medium-severity findings. */
    mediumFindings: number;
    /** Number of low-severity findings. */
    lowFindings: number;
    /** Number of informational findings. */
    informationalFindings: number;
    /** Number of findings flagged as likely false positives. */
    falsePositiveCount?: number;
  };
  /** Full markdown report content. */
  markdownReport?: string;
  /** Total execution time in milliseconds. */
  executionTime?: number;
}

/** Action configuration parsed from inputs. */
export interface ActionConfig {
  /** Odin Scan API key. */
  apiKey: string;
  /** API base URL. */
  apiUrl: string;
  /** Target platform for analysis. */
  platform: Platform;
  /** Minimum severity that triggers failure. */
  severityThreshold: ThresholdLevel;
  /** Whether to fail the workflow on findings above threshold. */
  failOnFindings: boolean;
  /** Whether to post a summary comment on pull requests. */
  commentOnPr: boolean;
  /** Whether to upload SARIF to GitHub Code Scanning. */
  uploadSarif: boolean;
  /** Whether to upload the full report as a workflow artifact. */
  uploadArtifact: boolean;
  /** Maximum wait time for analysis completion in seconds. */
  timeout: number;
  /** GitHub token for API interactions. */
  githubToken: string;
}
