<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref } from "vue";
import {
  FolderIcon,
  FolderOpenIcon,
  MoonIcon,
  SunIcon,
  TerminalIcon,
  XIcon,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import AppSidebar from "@/components/AppSidebar.vue";
import FileDetails from "@/components/FileDetails.vue";
import RequestBar from "@/components/RequestBar.vue";
import RequestEditor from "@/components/RequestEditor.vue";
import ResponsePane from "@/components/ResponsePane.vue";
import WelcomeScreen from "@/components/WelcomeScreen.vue";
import { hurlVersion } from "@/lib/runner";
import { theme, toggleTheme } from "@/lib/theme";
import {
  checkForUpdates,
  downloadProgress,
  installUpdate,
  pendingUpdate,
  restartApp,
  updateError,
  updatePhase,
} from "@/lib/updater";
import {
  activeEntry,
  activeModel,
  anyDirty,
  closeFile,
  deleteEntry,
  isDirty,
  openFile,
  pickWorkspace,
  refreshFiles,
  runEntry,
  saveAllFiles,
  workspace,
} from "@/stores/workspace";

const version = ref("…");

const entryToDelete = ref<{ relPath: string; entryId: string } | null>(null);

const entryToDeleteInfo = computed(() => {
  const target = entryToDelete.value;
  if (!target) return null;
  const model = workspace.models[target.relPath];
  const entry = model?.entries.find((e) => e.id === target.entryId);
  if (!entry) return null;
  return {
    name: entry.name || `${entry.method} ${entry.url}`,
    detail: `${entry.method} ${entry.url}`,
  };
});

provide("askDeleteEntry", (relPath: string, entryId: string) => {
  entryToDelete.value = { relPath, entryId };
});

function confirmDeleteEntry() {
  const target = entryToDelete.value;
  if (!target) return;
  entryToDelete.value = null;
  deleteEntry(target.relPath, target.entryId);
}

const workspaceName = computed(() => {
  const dir = workspace.workspaceDir;
  if (!dir) return null;
  return dir.split("/").filter(Boolean).pop() ?? dir;
});

const showFileDetails = computed(
  () =>
    activeModel.value && !activeModel.value.raw && !activeEntry.value,
);

const updateProgressPct = computed(() => {
  const { downloaded, total } = downloadProgress.value;
  if (!total) return 0;
  return Math.min(100, Math.round((downloaded / total) * 100));
});

onMounted(async () => {
  version.value = await hurlVersion();
  if (workspace.workspaceDir) refreshFiles();
  checkForUpdates();
});

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveAllFiles();
  }
  if (
    (e.metaKey || e.ctrlKey) &&
    e.key === "Enter" &&
    activeModel.value &&
    activeEntry.value
  ) {
    e.preventDefault();
    runEntry(activeModel.value.relPath, activeEntry.value);
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="flex h-screen w-screen flex-col overflow-hidden">
    <header
      class="flex h-10 shrink-0 items-center gap-2 border-b bg-muted/40 px-3"
    >
      <TerminalIcon class="size-4 text-primary" />
      <span class="text-sm font-semibold">Hurl Bench</span>
      <span class="text-[10px] text-muted-foreground">{{ version }}</span>
      <template v-if="workspaceName">
        <span class="text-border">·</span>
        <FolderIcon class="size-3.5 text-muted-foreground" />
        <span
          class="max-w-64 truncate font-mono text-[10px] text-muted-foreground"
          :title="workspace.workspaceDir ?? ''"
        >
          {{ workspaceName }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="size-6"
          title="Change workspace"
          @click="pickWorkspace"
        >
          <FolderOpenIcon class="size-3.5" />
        </Button>
      </template>
      <Button
        variant="outline"
        size="sm"
        class="ml-auto h-7 px-2 font-mono text-[10px] disabled:pointer-events-auto disabled:cursor-pointer"
        :disabled="!anyDirty"
        title="Save all files"
        @click="saveAllFiles"
      >
        Save (⌘ + S)
      </Button>
      <span class="font-mono text-[10px] text-muted-foreground">· ⌘↵ send</span>
      <Button
        variant="ghost"
        size="icon"
        class="size-7"
        :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggleTheme"
      >
        <SunIcon v-if="theme === 'dark'" class="size-4" />
        <MoonIcon v-else class="size-4" />
      </Button>
    </header>

    <WelcomeScreen v-if="!workspace.workspaceDir" />

    <ResizablePanelGroup v-else direction="horizontal" class="min-h-0 flex-1">
      <ResizablePanel :default-size="20" :min-size="14" :max-size="40">
        <AppSidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel :default-size="80">
        <div class="flex h-full flex-col">
          <div
            v-if="workspace.openPaths.length"
            class="flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b px-1"
          >
            <div
              v-for="path in workspace.openPaths"
              :key="path"
              class="group flex cursor-pointer items-center gap-1 rounded-t-md border border-b-0 px-2.5 py-1.5 font-mono text-xs"
              :class="
                workspace.activePath === path
                  ? 'bg-background text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted/60'
              "
              @click="openFile(path)"
            >
              {{ path.split("/").pop() }}
              <span
                v-if="workspace.models[path] && isDirty(workspace.models[path])"
                class="size-1.5 shrink-0 rounded-full bg-amber-500"
                title="Unsaved changes"
              />
              <button
                class="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted"
                @click.stop="closeFile(path)"
              >
                <XIcon class="size-3" />
              </button>
            </div>
          </div>

          <ResizablePanelGroup direction="vertical" class="min-h-0 flex-1">
            <ResizablePanel :default-size="55" :min-size="25">
              <div class="flex h-full flex-col">
                <div v-if="activeEntry" class="shrink-0 border-b">
                  <RequestBar />
                </div>
                <div class="min-h-0 flex-1">
                  <FileDetails v-if="showFileDetails" />
                  <RequestEditor v-else />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle with-handle />
            <ResizablePanel :default-size="45" :min-size="15">
              <ResponsePane />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>

    <Dialog
      :open="entryToDelete !== null"
      @update:open="(v) => { if (!v) entryToDelete = null; }"
    >
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete request</DialogTitle>
          <DialogDescription v-if="entryToDeleteInfo">
            Delete
            <span class="font-medium">{{ entryToDeleteInfo.name }}</span>
            <span class="block truncate font-mono text-[10px]">
              {{ entryToDeleteInfo.detail }}
            </span>
            from <span class="font-mono">{{ entryToDelete?.relPath }}</span>?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="entryToDelete = null">
            Cancel
          </Button>
          <Button variant="destructive" size="sm" @click="confirmDeleteEntry">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      :open="updatePhase !== 'idle'"
      @update:open="(v) => { if (!v && updatePhase !== 'downloading') updatePhase = 'idle'; }"
    >
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle v-if="updatePhase === 'ready'">Update installed</DialogTitle>
          <DialogTitle v-else>Update available</DialogTitle>
          <DialogDescription v-if="pendingUpdate">
            Version
            <span class="font-mono font-medium">{{ pendingUpdate.version }}</span>
            <template v-if="updatePhase === 'ready'">
              is installed. Restart Hurl Bench to use it.
            </template>
            <template v-else>is available.</template>
          </DialogDescription>
        </DialogHeader>
        <div
          v-if="pendingUpdate?.body && updatePhase === 'available'"
          class="max-h-40 overflow-y-auto rounded-md border bg-muted/40 p-2 text-xs whitespace-pre-wrap"
        >
          {{ pendingUpdate.body }}
        </div>
        <div v-if="updatePhase === 'downloading'" class="space-y-1.5">
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full bg-primary transition-all"
              :style="{ width: `${updateProgressPct}%` }"
            />
          </div>
          <p class="font-mono text-[10px] text-muted-foreground">
            Downloading… {{ updateProgressPct }}%
          </p>
        </div>
        <p v-if="updatePhase === 'error'" class="text-xs text-destructive">
          Update failed: {{ updateError }}
        </p>
        <DialogFooter>
          <template v-if="updatePhase === 'ready'">
            <Button size="sm" @click="restartApp">Restart now</Button>
          </template>
          <template v-else>
            <Button
              variant="outline"
              size="sm"
              :disabled="updatePhase === 'downloading'"
              @click="updatePhase = 'idle'"
            >
              Later
            </Button>
            <Button
              size="sm"
              :disabled="updatePhase === 'downloading'"
              @click="installUpdate"
            >
              {{ updatePhase === 'error' ? 'Retry' : 'Download & install' }}
            </Button>
          </template>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Toaster position="bottom-right" />
  </div>
</template>
