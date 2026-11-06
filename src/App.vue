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
  activeEntry,
  activeModel,
  closeFile,
  deleteEntry,
  isDirty,
  openFile,
  pickWorkspace,
  refreshFiles,
  runEntry,
  saveActiveFile,
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

const dirtyActive = computed(() =>
  activeModel.value ? isDirty(activeModel.value) : false,
);

onMounted(async () => {
  version.value = await hurlVersion();
  if (workspace.workspaceDir) refreshFiles();
});

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveActiveFile();
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
        class="ml-auto h-7 px-2 font-mono text-[10px]"
        :disabled="!dirtyActive"
        title="Save file"
        @click="saveActiveFile"
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

    <Toaster position="bottom-right" />
  </div>
</template>
