import { randomUUID } from 'crypto';

const REPORT_API_BASE_URL = 'https://jegdn.com/api/design-tools';
const REPORT_API_KEY = 'JEGTECHNOLOGY@2026';
const MAX_RETRIES = 3;

interface TrackUsageResult {
  success: boolean;
  message?: string;
  requestId: string;
  data?: {
    id: number;
    request_id: string;
    tool_type: string;
    total_cost: number;
    api_costs?: Record<string, number>;
    created_at: string;
  };
  error?: string;
}

interface UsageReportResult {
  success: boolean;
  data?: {
    user_id: number;
    user_name: string;
    date_range: { start: string; end: string };
    summary: { total_cost: number; total_usage: number };
    tools: Record<string, { count: number; cost: number }>;
    pricing: Record<string, number>;
  };
  error?: string;
}

export class DesignToolReportService {
  private username: string = '';

  setUsername(username: string) {
    this.username = username;
  }

  getUsername(): string {
    return this.username;
  }

  private getHeaders(): Record<string, string> {
    return {
      'X-API-Key': REPORT_API_KEY,
      'X-Username': this.username,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Track a tool usage with retry logic and idempotent request_id.
   * Only call this after a tool completes SUCCESSFULLY.
   */
  async trackUsage(
    toolType: string,
    optionsUsed: Record<string, any> = {},
    requestId?: string
  ): Promise<TrackUsageResult> {
    if (!this.username) {
      console.warn('[ReportAPI] No username set, skipping track-usage');
      return { success: false, requestId: '', error: 'No username set' };
    }

    const reqId = requestId || randomUUID();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${REPORT_API_BASE_URL}/track-usage`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            request_id: reqId,
            tool_type: toolType,
            options_used: optionsUsed,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          console.log(`[ReportAPI] Tracked ${toolType}: cost=$${data.data?.total_cost ?? '?'}, reqId=${reqId}`);
          return { success: true, requestId: reqId, ...data };
        }

        // Non-retryable errors (validation, auth)
        if (response.status === 401 || response.status === 400 || response.status === 404 || response.status === 422) {
          console.error(`[ReportAPI] Track failed (${response.status}):`, data);
          return { success: false, requestId: reqId, error: data.message || `HTTP ${response.status}` };
        }

        // Server error - retry
        console.warn(`[ReportAPI] Track attempt ${attempt + 1} failed (HTTP ${response.status}), retrying...`);
      } catch (error: any) {
        console.warn(`[ReportAPI] Track attempt ${attempt + 1} network error:`, error.message);
      }

      // Exponential backoff before retry
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    console.error(`[ReportAPI] Track failed after ${MAX_RETRIES} retries`);
    return { success: false, requestId: reqId, error: `Failed after ${MAX_RETRIES} retries` };
  }

  /**
   * Get usage report for the current user.
   */
  async getUsageReport(startDate?: string, endDate?: string): Promise<UsageReportResult> {
    if (!this.username) {
      return { success: false, error: 'No username set' };
    }

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      let url = `${REPORT_API_BASE_URL}/usage-report`;
      if (params.toString()) url += '?' + params.toString();

      const response = await fetch(url, {
        headers: {
          'X-API-Key': REPORT_API_KEY,
          'X-Username': this.username,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return data;
      }

      return { success: false, error: data.message || `HTTP ${response.status}` };
    } catch (error: any) {
      console.error('[ReportAPI] getUsageReport error:', error.message);
      return { success: false, error: error.message };
    }
  }
}
