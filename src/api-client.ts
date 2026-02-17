import * as core from '@actions/core';
import type {
  VerifyKeyResponse,
  CreateAnalysisResponse,
  AnalysisStatusResponse,
  AnalysisResult,
} from './types';

/**
 * HTTP client for the Odin Scan API.
 *
 * Wraps fetch with authentication headers and typed responses
 * for all supported API endpoints.
 */
export class OdinScanClient {
  /** Base URL for API requests (without trailing slash). */
  private baseUrl: string;
  /** API key used for Bearer authentication. */
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  /**
   * Sends an authenticated request to the API.
   *
   * Automatically attaches authorization headers and parses
   * JSON responses. Throws on non-2xx status codes.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'odin-scan-action/1.0',
      ...((options.headers as Record<string, string>) || {}),
    };

    core.debug(`API request: ${options.method || 'GET'} ${path}`);

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API error ${response.status}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  /** Validates the API key and returns plan info. */
  async verifyKey(): Promise<VerifyKeyResponse> {
    return this.request<VerifyKeyResponse>('/api/v1/auth/verify-key', {
      method: 'POST',
    });
  }

  /** Creates a new analysis for the given repository. */
  async createAnalysis(params: {
    repositoryUrl: string;
    repositoryName: string;
    contractFramework: string;
    branch?: string;
    externalGithubToken?: string;
  }): Promise<CreateAnalysisResponse> {
    return this.request<CreateAnalysisResponse>('/api/v1/analysis', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /** Polls the current status of an analysis. */
  async getAnalysisStatus(analysisId: string): Promise<AnalysisStatusResponse> {
    return this.request<AnalysisStatusResponse>(`/api/v1/analysis/${analysisId}/status`);
  }

  /** Retrieves the full analysis results including findings. */
  async getAnalysisResult(analysisId: string): Promise<AnalysisResult> {
    return this.request<AnalysisResult>(`/api/v1/analysis/${analysisId}/result`);
  }
}
