import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@/lib/runner";
import type { HistoryFileInfo, HurlFileInfo } from "@/types";

const DESKTOP_ONLY =
  "File access requires the desktop app. Start it with `pnpm tauri dev`.";

function requireTauri() {
  if (!isTauri()) throw new Error(DESKTOP_ONLY);
}

export async function pickWorkspaceDir(
  title = "Choose workspace folder",
): Promise<string | null> {
  requireTauri();
  const selected = await open({ directory: true, title });
  return typeof selected === "string" ? selected : null;
}

export async function listHurlFiles(dir: string): Promise<HurlFileInfo[]> {
  requireTauri();
  return invoke<HurlFileInfo[]>("list_hurl_files", { dir });
}

export async function listHurlFolders(dir: string): Promise<string[]> {
  requireTauri();
  return invoke<string[]>("list_hurl_folders", { dir });
}

export async function listHistoryFiles(
  dir: string,
  relPath: string,
): Promise<HistoryFileInfo[]> {
  requireTauri();
  return invoke<HistoryFileInfo[]>("list_history_files", { dir, relPath });
}

export async function readHurlFile(path: string): Promise<string> {
  requireTauri();
  return invoke<string>("read_hurl_file", { path });
}

export async function writeHurlFile(
  path: string,
  content: string,
): Promise<void> {
  requireTauri();
  return invoke("write_hurl_file", { path, content });
}

export async function createHurlFile(
  dir: string,
  relPath: string,
): Promise<void> {
  requireTauri();
  return invoke("create_hurl_file", { dir, relPath });
}

export async function createHurlFolder(
  dir: string,
  relPath: string,
): Promise<void> {
  requireTauri();
  return invoke("create_hurl_folder", { dir, relPath });
}

export async function deleteHurlFile(path: string): Promise<void> {
  requireTauri();
  return invoke("delete_hurl_file", { path });
}

export async function deleteHurlFolder(
  dir: string,
  relPath: string,
): Promise<void> {
  requireTauri();
  return invoke("delete_hurl_folder", { dir, relPath });
}
