import { computed, reactive, watch } from "vue";
import { toast } from "vue-sonner";
import {
  createHurlFile,
  createHurlFolder,
  deleteHurlFile,
  deleteHurlFolder,
  listHurlFiles,
  listHurlFolders,
  pickWorkspaceDir,
  readHurlFile,
  writeHurlFile,
} from "@/lib/files";
import { recordHistory } from "@/lib/history";
import { parseHurlFile, serializeEntries, serializeEntry } from "@/lib/hurl";
import { parseResponses, runHurl } from "@/lib/runner";
import type {
  HurlEntry,
  HurlFileInfo,
  HttpMethod,
  KeyValue,
  RunResult,
} from "@/types";

const STORAGE_KEY = "hurl-bench-workspace-v2";

const uid = () => crypto.randomUUID();

export function kv(key = "", value = ""): KeyValue {
  return { id: uid(), enabled: true, key, value };
}

export function newEntry(name = "New Request"): HurlEntry {
  return {
    id: uid(),
    name,
    method: "GET",
    url: "https://",
    queryParams: [],
    headers: [],
    body: "",
    asserts: [kv("status", "== 200")],
  };
}

export interface FileModel {
  relPath: string;
  /** Structured entries; empty when `raw` is true. */
  entries: HurlEntry[];
  /** True when the file uses hurl syntax outside the designer subset. */
  raw: boolean;
  /** Editable file text in raw mode. */
  rawContent: string;
  /** Content as last loaded/saved, for dirty tracking. */
  savedContent: string;
}

interface WorkspaceState {
  workspaceDir: string | null;
  /** Previously opened workspace dirs, most recent first. */
  recentWorkspaces: string[];
  files: HurlFileInfo[];
  /** Folder paths relative to the workspace root (includes empty folders). */
  folders: string[];
  openPaths: string[];
  activePath: string | null;
  activeEntryId: string | null;
  models: Record<string, FileModel>;
  running: boolean;
  runs: Record<string, RunResult[]>;
}

interface PersistedState {
  workspaceDir: string | null;
  recentWorkspaces: string[];
  openPaths: string[];
  activePath: string | null;
  activeEntryId: string | null;
}

/** Last session's open tabs, reused when the same workspace is picked again. */
let lastSession: {
  dir: string;
  openPaths: string[];
  activePath: string | null;
  activeEntryId: string | null;
} | null = null;

function load(): WorkspaceState {
  const state: WorkspaceState = {
    workspaceDir: null,
    recentWorkspaces: [],
    files: [],
    folders: [],
    openPaths: [],
    activePath: null,
    activeEntryId: null,
    models: {},
    running: false,
    runs: {},
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.workspaceDir) {
        lastSession = {
          dir: parsed.workspaceDir,
          openPaths: parsed.openPaths ?? [],
          activePath: parsed.activePath ?? null,
          activeEntryId: parsed.activeEntryId ?? null,
        };
      }
      return {
        ...state,
        // Always start on the workspace chooser — never resume directly.
        recentWorkspaces: parsed.recentWorkspaces ?? [],
      };
    }
  } catch {
    // fall through to empty state
  }
  return state;
}

export const workspace = reactive<WorkspaceState>(load());

watch(
  () => [
    workspace.workspaceDir,
    workspace.recentWorkspaces,
    workspace.openPaths,
    workspace.activePath,
    workspace.activeEntryId,
  ],
  () => {
    const persisted: PersistedState = {
      workspaceDir: workspace.workspaceDir,
      recentWorkspaces: workspace.recentWorkspaces,
      openPaths: workspace.openPaths,
      activePath: workspace.activePath,
      activeEntryId: workspace.activeEntryId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  },
  { deep: true },
);

export const activeModel = computed(() =>
  workspace.activePath ? workspace.models[workspace.activePath] : null,
);

export const activeEntry = computed(() => {
  const model = activeModel.value;
  if (!model || model.raw) return null;
  return (
    model.entries.find((e) => e.id === workspace.activeEntryId) ?? null
  );
});

function lastRunFor(key: string | null): RunResult | null {
  const list = key ? workspace.runs[key] : undefined;
  return list?.length ? list[list.length - 1] : null;
}

export const latestRun = computed(() => {
  const entryRun = lastRunFor(activeEntry.value?.id ?? null);
  const fileRun = lastRunFor(workspace.activePath);
  if (entryRun && fileRun) {
    return fileRun.startedAt > entryRun.startedAt ? fileRun : entryRun;
  }
  return entryRun ?? fileRun;
});

export function modelContent(model: FileModel): string {
  return model.raw ? model.rawContent : serializeEntries(model.entries);
}

export function isDirty(model: FileModel): boolean {
  return modelContent(model) !== model.savedContent;
}

function absPath(relPath: string): string {
  return `${workspace.workspaceDir}/${relPath}`;
}

async function loadModel(relPath: string): Promise<FileModel | null> {
  try {
    const content = await readHurlFile(absPath(relPath));
    const entries = parseHurlFile(content);
    return entries === null
      ? {
          relPath,
          entries: [],
          raw: true,
          rawContent: content,
          savedContent: content,
        }
      : {
          relPath,
          entries,
          raw: false,
          rawContent: "",
          savedContent: content,
        };
  } catch (e) {
    toast.error(`Could not read ${relPath}`, { description: String(e) });
    return null;
  }
}

function pushRecentWorkspace(dir: string) {
  workspace.recentWorkspaces = [
    dir,
    ...workspace.recentWorkspaces.filter((d) => d !== dir),
  ].slice(0, 8);
}

export function removeRecentWorkspace(dir: string) {
  workspace.recentWorkspaces = workspace.recentWorkspaces.filter(
    (d) => d !== dir,
  );
}

export async function openWorkspaceDir(dir: string) {
  workspace.workspaceDir = dir;
  const resume = lastSession?.dir === dir ? lastSession : null;
  workspace.openPaths = resume?.openPaths ?? [];
  workspace.activePath = resume?.activePath ?? null;
  workspace.activeEntryId = resume?.activeEntryId ?? null;
  workspace.models = {};
  await refreshFiles();
  // refreshFiles toasts and keeps going on a missing/unreadable dir — but a
  // workspace with zero files and zero folders that also failed to list is
  // indistinguishable from a fresh empty one, so only prune on throw.
  pushRecentWorkspace(dir);
}

export async function pickWorkspace() {
  try {
    const dir = await pickWorkspaceDir("Choose workspace folder");
    if (!dir) return;
    await openWorkspaceDir(dir);
  } catch (e) {
    toast.error("Could not open workspace", { description: String(e) });
  }
}

export async function newWorkspace() {
  try {
    const dir = await pickWorkspaceDir(
      "Choose or create a folder for the new workspace",
    );
    if (!dir) return;
    await openWorkspaceDir(dir);
  } catch (e) {
    toast.error("Could not create workspace", { description: String(e) });
  }
}

export async function refreshFiles() {
  const dir = workspace.workspaceDir;
  if (!dir) return;
  try {
    [workspace.files, workspace.folders] = await Promise.all([
      listHurlFiles(dir),
      listHurlFolders(dir),
    ]);
    for (const file of workspace.files) {
      const existing = workspace.models[file.rel_path];
      if (existing && isDirty(existing)) continue;
      const model = await loadModel(file.rel_path);
      if (model) workspace.models[file.rel_path] = model;
    }
    for (const path of [...workspace.openPaths]) {
      if (!workspace.files.some((f) => f.rel_path === path)) closeFile(path);
    }
  } catch (e) {
    toast.error("Could not list workspace files", { description: String(e) });
  }
}

/** Opens the file tab in file-details view (no entry selected). */
export function openFile(relPath: string) {
  workspace.activePath = relPath;
  if (!workspace.openPaths.includes(relPath)) workspace.openPaths.push(relPath);
  workspace.activeEntryId = null;
}

export function selectEntry(relPath: string, entryId: string) {
  openFile(relPath);
  workspace.activeEntryId = entryId;
}

export function closeFile(relPath: string) {
  const idx = workspace.openPaths.indexOf(relPath);
  if (idx === -1) return;
  workspace.openPaths.splice(idx, 1);
  if (workspace.activePath === relPath) {
    const next = workspace.openPaths[Math.max(0, idx - 1)] ?? null;
    workspace.activePath = next;
    workspace.activeEntryId = null;
  }
}

export async function deleteFile(relPath: string) {
  try {
    await deleteHurlFile(absPath(relPath));
    delete workspace.models[relPath];
    closeFile(relPath);
    await refreshFiles();
    toast.success(`Deleted ${relPath}`);
  } catch (e) {
    toast.error(`Could not delete ${relPath}`, { description: String(e) });
  }
}

export async function deleteFolder(relPath: string) {
  const dir = workspace.workspaceDir;
  if (!dir) return;
  try {
    await deleteHurlFolder(dir, relPath);
    const prefix = `${relPath}/`;
    for (const path of Object.keys(workspace.models)) {
      if (path.startsWith(prefix)) delete workspace.models[path];
    }
    for (const path of [...workspace.openPaths]) {
      if (path.startsWith(prefix)) closeFile(path);
    }
    await refreshFiles();
    toast.success(`Deleted ${relPath}`);
  } catch (e) {
    toast.error(`Could not delete ${relPath}`, { description: String(e) });
  }
}

export async function newFile(name: string) {
  const dir = workspace.workspaceDir;
  if (!dir) return;
  try {
    await createHurlFile(dir, name);
    await refreshFiles();
    const relPath = name.trim().endsWith(".hurl")
      ? name.trim()
      : `${name.trim()}.hurl`;
    const model = workspace.models[relPath];
    if (model && model.entries.length === 0 && !model.raw) {
      model.entries.push(newEntry("New Request"));
      await saveFile(relPath);
    }
    openFile(relPath);
  } catch (e) {
    toast.error("Could not create file", { description: String(e) });
  }
}

export async function newFolder(name: string) {
  const dir = workspace.workspaceDir;
  if (!dir) return;
  try {
    await createHurlFolder(dir, name);
    await refreshFiles();
  } catch (e) {
    toast.error("Could not create folder", { description: String(e) });
  }
}

export function addEntry(relPath: string) {
  const model = workspace.models[relPath];
  if (!model || model.raw) return;
  const entry = newEntry(`Request ${model.entries.length + 1}`);
  model.entries.push(entry);
  selectEntry(relPath, entry.id);
}

export function deleteEntry(relPath: string, entryId: string) {
  const model = workspace.models[relPath];
  if (!model || model.raw) return;
  const idx = model.entries.findIndex((e) => e.id === entryId);
  if (idx !== -1) model.entries.splice(idx, 1);
  if (workspace.activeEntryId === entryId) {
    workspace.activeEntryId = model.entries[0]?.id ?? null;
  }
}

export function setEntryMethod(entry: HurlEntry, method: string) {
  entry.method = method as HttpMethod;
}

export async function saveFile(relPath: string): Promise<boolean> {
  const model = workspace.models[relPath];
  if (!model) return false;
  const content = modelContent(model);
  try {
    await writeHurlFile(absPath(relPath), content);
    model.savedContent = content;
    return true;
  } catch (e) {
    toast.error(`Could not save ${relPath}`, { description: String(e) });
    return false;
  }
}

/** True when any loaded file has unsaved changes. */
export const anyDirty = computed(() =>
  Object.values(workspace.models).some((model) => isDirty(model)),
);

export async function saveActiveFile() {
  if (workspace.activePath) {
    const saved = await saveFile(workspace.activePath);
    if (saved) toast.success(`Saved ${workspace.activePath}`);
  }
}

/** Saves every loaded file with unsaved changes. */
export async function saveAllFiles() {
  const dirty = Object.keys(workspace.models).filter((relPath) =>
    isDirty(workspace.models[relPath]),
  );
  if (dirty.length === 0) return;
  const results = await Promise.all(dirty.map(saveFile));
  const savedCount = results.filter(Boolean).length;
  if (savedCount === 0) return;
  toast.success(
    savedCount === dirty.length
      ? `Saved ${savedCount === 1 ? dirty[0] : `${savedCount} files`}`
      : `Saved ${savedCount} of ${dirty.length} files`,
  );
}

async function pushRun(
  key: string,
  name: string,
  fileRun: boolean,
  run: () => Promise<RunResult>,
): Promise<RunResult | null> {
  if (workspace.running) return null;
  workspace.running = true;
  try {
    const result = await run();
    (workspace.runs[key] ??= []).push(result);
    return result;
  } catch (e) {
    toast.error("Could not run hurl", { description: String(e) });
    (workspace.runs[key] ??= []).push({
      id: uid(),
      entryId: key,
      entryName: name,
      startedAt: Date.now(),
      durationMs: 0,
      exitCode: -1,
      stdout: "",
      stderr: String(e),
      report: "",
      responses: [],
      response: null,
      fileRun,
      error: String(e),
    });
    return null;
  } finally {
    workspace.running = false;
  }
}

/** Absolute directory of a workspace-relative file, for hurl's file root. */
function fileRootFor(relPath: string): string | undefined {
  const dir = workspace.workspaceDir;
  if (!dir) return undefined;
  const idx = relPath.lastIndexOf("/");
  return idx === -1 ? dir : `${dir}/${relPath.slice(0, idx)}`;
}

async function execute(
  name: string,
  key: string,
  content: string,
  filename: string,
  fileRun: boolean,
): Promise<RunResult> {
  const out = await runHurl(content, filename, fileRootFor(filename));
  const responses = parseResponses(out.report, out.bodies);
  return {
    id: uid(),
    entryId: key,
    entryName: name,
    startedAt: Date.now(),
    durationMs: out.duration_ms,
    exitCode: out.exit_code,
    stdout: out.stdout,
    stderr: out.stderr,
    report: out.report,
    responses,
    response: responses.length ? responses[responses.length - 1] : null,
    fileRun,
    error: out.exit_code === 0 ? null : out.stderr || "hurl exited non-zero",
  };
}

function recordRunHistory(
  relPath: string,
  content: string,
  result: RunResult | null,
  requestBodies: (string | null)[] = [],
  entryName: string | null = null,
) {
  const dir = workspace.workspaceDir;
  if (!result || !dir) return;
  recordHistory(dir, relPath, content, result, requestBodies, entryName).catch(
    (e) => toast.error("Could not save history", { description: String(e) }),
  );
}

function generatedEntryName(entry: HurlEntry): string {
  let target = entry.url.trim();
  try {
    const u = new URL(target);
    target = u.host + u.pathname.replace(/\/$/, "");
  } catch {
    target = target.replace(/^https?:\/\//, "");
  }
  const keys = entry.queryParams
    .filter((p) => p.enabled && p.key.trim() !== "")
    .map((p) => p.key.trim());
  if (keys.length) target += `?${keys.join(",")}`;
  const name = `${entry.method} ${target}`;
  return name.length > 60 ? name.slice(0, 57) + "..." : name;
}

export async function runEntry(relPath: string, entry: HurlEntry) {
  const unnamed =
    !entry.name.trim() || /^(New Request|Request \d+)$/.test(entry.name.trim());
  if (unnamed) entry.name = generatedEntryName(entry);
  await saveFile(relPath);
  const content = serializeEntry(entry);
  const result = await pushRun(entry.id, entry.name, false, () =>
    execute(entry.name, entry.id, content, relPath, false),
  );
  recordRunHistory(relPath, content, result, [entry.body], entry.name);
}

export async function runFile(relPath: string) {
  const model = workspace.models[relPath];
  if (!model) return;
  await saveFile(relPath);
  const content = modelContent(model);
  const result = await pushRun(relPath, relPath, true, () =>
    execute(relPath, relPath, content, relPath, true),
  );
  recordRunHistory(
    relPath,
    content,
    result,
    model.raw ? [] : model.entries.map((e) => e.body),
  );
}
