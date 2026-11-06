import { writeHurlFile } from "@/lib/files";
import type { RunResult } from "@/types";

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

/** Filesystem-safe local timestamp: yyyyMMdd-HHmmss-SSS. */
function stamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
    `-${pad(d.getMilliseconds(), 3)}`
  );
}

/** getting-data/query-params.hurl → getting-data/query-params.hurl.20261106-123456-789.history.txt */
export function historyFileName(relPath: string, date: Date): string {
  const idx = relPath.lastIndexOf("/");
  const dir = idx === -1 ? "" : relPath.slice(0, idx + 1);
  const base = idx === -1 ? relPath : relPath.slice(idx + 1);
  return `${dir}${base}.${stamp(date)}.history.txt`;
}

function looksBinary(body: string): boolean {
  // Replacement char (lossy UTF-8 decode of binary) or C0 control chars
  // other than \t \n \r.
  return /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(body);
}

const REASONS: Record<number, string> = {
  100: "Continue", 101: "Switching Protocols",
  200: "OK", 201: "Created", 202: "Accepted", 203: "Non-Authoritative Information",
  204: "No Content", 205: "Reset Content", 206: "Partial Content",
  300: "Multiple Choices", 301: "Moved Permanently", 302: "Found",
  303: "See Other", 304: "Not Modified", 307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 402: "Payment Required",
  403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed",
  406: "Not Acceptable", 408: "Request Timeout", 409: "Conflict",
  410: "Gone", 411: "Length Required", 413: "Content Too Large",
  414: "URI Too Long", 415: "Unsupported Media Type", 418: "I'm a Teapot",
  422: "Unprocessable Content", 425: "Too Early", 429: "Too Many Requests",
  500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway",
  503: "Service Unavailable", 504: "Gateway Timeout",
};

function pathWithQuery(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname || "/") + u.search;
  } catch {
    return url;
  }
}

function statusLine(version: string, status: number | null): string {
  const v = version || "HTTP/1.1";
  if (status === null) return v;
  const reason = REASONS[status];
  return `${v} ${status}${reason ? ` ${reason}` : ""}`;
}

/**
 * Plain-text record of one run, in curl --verbose style: `>` request
 * lines, `<` response lines, `*` notes. `content` (the exact hurl source
 * executed) is kept at the top so request bodies survive verbatim.
 */
export function buildHistoryText(
  relPath: string,
  content: string,
  result: RunResult,
  requestBodies: (string | null)[] = [],
  entryName: string | null = null,
): string {
  const lines: string[] = [
    "# Hurl Bench run history",
    `# File: ${relPath}`,
  ];
  if (entryName) lines.push(`# Entry: ${entryName}`);
  lines.push(
    `# Time: ${new Date(result.startedAt).toISOString()}`,
    `# Duration: ${result.durationMs} ms · exit code ${result.exitCode}`,
    "",
    "--- hurl source ---",
    content.trimEnd(),
    "",
  );
  result.responses.forEach((r, i) => {
    if (result.responses.length > 1) {
      lines.push(`* Entry ${i + 1} of ${result.responses.length}`);
    }
    lines.push(`> ${r.method} ${pathWithQuery(r.url)} ${r.version || "HTTP/1.1"}`);
    for (const h of r.requestHeaders) lines.push(`> ${h.name}: ${h.value}`);
    const reqBody = requestBodies[i]?.trim();
    if (reqBody) {
      lines.push(">");
      for (const l of reqBody.split("\n")) lines.push(`> ${l}`);
    }
    lines.push("<");
    lines.push(`< ${statusLine(r.version, r.status)}`);
    for (const h of r.headers) lines.push(`< ${h.name}: ${h.value}`);
    lines.push("<");
    lines.push(
      looksBinary(r.body)
        ? `<binary body omitted, ${r.body.length} bytes>`
        : r.body.trimEnd(),
    );
    lines.push("");
  });
  if (result.error) {
    lines.push(`* Error: ${result.error}`);
  }
  return lines.join("\n");
}

/** Writes the history file alongside the .hurl file in the workspace. */
export async function recordHistory(
  dir: string,
  relPath: string,
  content: string,
  result: RunResult,
  requestBodies: (string | null)[] = [],
  entryName: string | null = null,
): Promise<void> {
  const rel = historyFileName(relPath, new Date(result.startedAt));
  await writeHurlFile(
    `${dir}/${rel}`,
    buildHistoryText(relPath, content, result, requestBodies, entryName),
  );
}
