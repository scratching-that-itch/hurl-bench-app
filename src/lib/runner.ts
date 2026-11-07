import { invoke } from "@tauri-apps/api/core";
import type { ParsedResponse } from "@/types";

export interface HurlRunOutput {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  /** Raw body of the last response. */
  body: string;
  /** Body of each entry's last response, aligned with the report's entries. */
  bodies: string[];
  /** JSON report, same shape as the CLI's `--report-json` output. */
  report: string;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function hurlVersion(): Promise<string> {
  if (!isTauri()) return "browser preview";
  try {
    return await invoke<string>("hurl_version");
  } catch {
    return "version unavailable";
  }
}

export async function runHurl(
  content: string,
  filename?: string,
  fileRoot?: string,
): Promise<HurlRunOutput> {
  if (!isTauri()) {
    throw new Error(
      "Running hurl requires the desktop app. Start it with `pnpm tauri dev`.",
    );
  }
  return invoke<HurlRunOutput>("run_hurl", { content, filename, fileRoot });
}

interface ReportResponse {
  status?: number;
  http_version?: string;
  headers?: { name: string; value: string }[];
}

interface ReportCall {
  request?: {
    method?: string;
    url?: string;
    headers?: { name: string; value: string }[];
  };
  response?: ReportResponse;
}

interface ReportEntry {
  calls?: ReportCall[];
  asserts?: { line: number; success: boolean }[];
}

/**
 * Parser for the run report: an array of file results, each with entries
 * whose calls carry responses. Bodies are not in the report — they come
 * from `HurlRunOutput.bodies`, aligned with entry order. Returns one
 * response per entry (its last call, i.e. after redirects).
 */
export function parseResponses(
  report: string,
  bodies: string[],
): ParsedResponse[] {
  try {
    const files = JSON.parse(report) as { entries?: ReportEntry[] }[];
    if (!Array.isArray(files)) return [];
    const responses: ParsedResponse[] = [];
    for (const file of files) {
      for (const [i, entry] of (file.entries ?? []).entries()) {
        const calls = entry.calls;
        const call = calls?.length ? calls[calls.length - 1] : undefined;
        const resp = call?.response;
        if (!resp) continue;
        responses.push({
          method: call?.request?.method ?? "",
          url: call?.request?.url ?? "",
          requestHeaders: Array.isArray(call?.request?.headers)
            ? call!.request!.headers!
            : [],
          status: typeof resp.status === "number" ? resp.status : null,
          version: resp.http_version ?? "",
          headers: Array.isArray(resp.headers) ? resp.headers : [],
          body: bodies[i] ?? "",
        });
      }
    }
    return responses;
  } catch {
    return [];
  }
}

/** Last entry's response, or null when the run produced none. */
export function parseLastResponse(
  report: string,
  bodies: string[],
): ParsedResponse | null {
  const responses = parseResponses(report, bodies);
  return responses.length ? responses[responses.length - 1] : null;
}

/** Try to pretty-print a body as JSON, otherwise return it unchanged. */
export function prettyBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
