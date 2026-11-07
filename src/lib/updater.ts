import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ref } from "vue";

export type UpdatePhase =
  | "idle"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export const updatePhase = ref<UpdatePhase>("idle");
export const pendingUpdate = ref<Update | null>(null);
export const updateError = ref("");
export const downloadProgress = ref({ downloaded: 0, total: 0 });

/// Queries the release endpoint for a newer version. Silent on failure
/// (offline, unsigned dev build, no release yet).
export async function checkForUpdates() {
  try {
    const update = await check();
    if (update) {
      pendingUpdate.value = update;
      updatePhase.value = "available";
    }
  } catch {
    updatePhase.value = "idle";
  }
}

export async function installUpdate() {
  const update = pendingUpdate.value;
  if (!update) return;
  updatePhase.value = "downloading";
  updateError.value = "";
  downloadProgress.value = { downloaded: 0, total: 0 };
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        downloadProgress.value.total = event.data.contentLength ?? 0;
      } else if (event.event === "Progress") {
        downloadProgress.value.downloaded += event.data.chunkLength;
      }
    });
    updatePhase.value = "ready";
  } catch (e) {
    updateError.value = String(e);
    updatePhase.value = "error";
  }
}

export async function restartApp() {
  await relaunch();
}
