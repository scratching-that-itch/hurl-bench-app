export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface KeyValue {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
}

export interface HurlEntry {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  queryParams: KeyValue[];
  headers: KeyValue[];
  body: string;
  /** key: predicate subject (e.g. `status`, `header "Content-Type"`), value: predicate (e.g. `== 200`) */
  asserts: KeyValue[];
}

export interface HurlFileInfo {
  /** Path relative to the workspace root, `/`-separated. */
  rel_path: string;
  name: string;
}

export interface HistoryFileInfo {
  /** File name, e.g. query-params.hurl.20261106-123456-789.history.txt */
  name: string;
  /** Absolute path, for read_hurl_file. */
  path: string;
  /** Entry name from the `# Entry:` header; null for whole-file runs. */
  entry: string | null;
}

export interface ParsedResponse {
  method: string;
  url: string;
  /** Headers as actually sent (from the report's call.request). */
  requestHeaders: { name: string; value: string }[];
  status: number | null;
  version: string;
  headers: { name: string; value: string }[];
  body: string;
}

export interface RunResult {
  id: string;
  entryId: string;
  entryName: string;
  startedAt: number;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Raw contents of hurl's report.json for this run. */
  report: string;
  /** One response per request (entry) in the run, in file order. */
  responses: ParsedResponse[];
  response: ParsedResponse | null;
  error: string | null;
}
