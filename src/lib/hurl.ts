import type { HurlEntry, HttpMethod, KeyValue } from "@/types";

export const METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-emerald-500",
  POST: "text-amber-500",
  PUT: "text-sky-500",
  PATCH: "text-violet-500",
  DELETE: "text-rose-500",
  HEAD: "text-teal-500",
  OPTIONS: "text-orange-400",
};

const uid = () => crypto.randomUUID();

const kv = (key = "", value = ""): KeyValue => ({
  id: uid(),
  enabled: true,
  key,
  value,
});

const kvLines = (items: KeyValue[]): string[] =>
  items
    .filter((i) => i.enabled && i.key.trim() !== "")
    .map((i) => (i.value.trim() === "" ? `${i.key}:` : `${i.key}: ${i.value}`));

export function serializeEntry(entry: HurlEntry): string {
  const lines: string[] = [];
  if (entry.name.trim()) lines.push(`# ${entry.name.trim()}`);
  lines.push(`${entry.method} ${entry.url.trim()}`);

  const headers = kvLines(entry.headers);
  if (headers.length) lines.push(...headers);

  const query = kvLines(entry.queryParams);
  if (query.length) lines.push("[Query]", ...query);

  if (entry.body.trim()) lines.push(entry.body.trim());

  lines.push("HTTP *");

  const asserts = entry.asserts
    .filter((a) => a.enabled && a.key.trim() !== "")
    .map((a) => `${a.key} ${a.value}`.trim());
  if (asserts.length) lines.push("[Asserts]", ...asserts);

  return lines.join("\n");
}

export function serializeEntries(entries: HurlEntry[]): string {
  return entries.map(serializeEntry).join("\n\n") + "\n";
}

const REQUEST_LINE =
  /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S.*)$/;
const HTTP_LINE = /^HTTP\s+(\S+).*$/;
const SECTION_LINE = /^\[(.+)\]$/;
const HEADER_LINE = /^([^:[\s][^:]*):\s*(.*)$/;
const ASSERT_LINE =
  /^(.+?)\s+(==|!=|>=|<=|>|<|contains|exists|startsWith|endsWith|matches|isEmpty|isNumber|isBoolean|isString|isCollection)(?=\s|$)\s*(.*)$/;

/**
 * Parses the hurl subset this app writes (request line, headers, [Query],
 * body, HTTP line, [Asserts]) back into entries. Returns null when the file
 * uses anything outside the subset — callers should fall back to raw mode so
 * the file is never mangled.
 */
export function parseHurlFile(content: string): HurlEntry[] | null {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const entries: HurlEntry[] = [];
  let entry: HurlEntry | null = null;
  let pendingName = "";
  let mode: "headers" | "query" | "asserts" | "body" | "after" = "headers";
  let bodyLines: string[] = [];

  const finishBody = () => {
    if (entry && bodyLines.length) {
      entry.body = bodyLines.join("\n").trim();
      bodyLines = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      if (mode === "body") bodyLines.push("");
      pendingName = "";
      continue;
    }

    if (line.startsWith("#")) {
      if (mode === "body" || bodyLines.length) return null;
      pendingName = line.slice(1).trim();
      continue;
    }

    const request = line.match(REQUEST_LINE);
    if (request) {
      finishBody();
      entry = {
        id: uid(),
        name: pendingName,
        method: request[1] as HttpMethod,
        url: request[2].trim(),
        queryParams: [],
        headers: [],
        body: "",
        asserts: [],
      };
      entries.push(entry);
      pendingName = "";
      mode = "headers";
      continue;
    }

    if (!entry) return null;

    const http = line.match(HTTP_LINE);
    if (http) {
      finishBody();
      if (http[1] !== "*") {
        if (!/^\d+$/.test(http[1])) return null;
        entry.asserts.unshift(kv("status", `== ${http[1]}`));
      }
      mode = "after";
      continue;
    }

    const section = line.match(SECTION_LINE);
    if (section) {
      finishBody();
      if (section[1] === "Query") mode = "query";
      else if (section[1] === "Asserts") mode = "asserts";
      else return null;
      continue;
    }

    if (mode === "query") {
      const m = line.match(HEADER_LINE);
      if (!m) return null;
      entry.queryParams.push(kv(m[1].trim(), m[2].trim()));
      continue;
    }

    if (mode === "asserts") {
      const m = line.match(ASSERT_LINE);
      if (!m) return null;
      entry.asserts.push(kv(m[1].trim(), `${m[2]} ${m[3]}`.trim()));
      continue;
    }

    if (mode === "headers" && !bodyLines.length) {
      const m = line.match(HEADER_LINE);
      if (m) {
        entry.headers.push(kv(m[1].trim(), m[2].trim()));
        continue;
      }
      mode = "body";
    }

    if (mode === "body") {
      bodyLines.push(line);
      continue;
    }

    // after the HTTP line: only implicit header asserts are valid here
    const implicit = line.match(HEADER_LINE);
    if (mode === "after" && implicit) {
      entry.asserts.push(
        kv(`header "${implicit[1].trim()}"`, `== "${implicit[2].trim()}"`),
      );
      continue;
    }
    return null;
  }
  finishBody();

  return entries;
}
