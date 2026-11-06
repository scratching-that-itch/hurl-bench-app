<script setup lang="ts">
import { inject } from "vue";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileCode2Icon,
  FolderIcon,
  PlusIcon,
  Trash2Icon,
} from "@lucide/vue";
import { METHOD_COLORS } from "@/lib/hurl";
import type { TreeFolder } from "@/lib/tree";
import { fileCollapsed, folderCollapsed } from "@/components/sidebar-state";
import {
  addEntry,
  isDirty,
  openFile,
  selectEntry,
  workspace,
} from "@/stores/workspace";

defineProps<{ node: TreeFolder }>();

const askNewFile = inject<(prefill: string) => void>("askNewFile", () => {});
const askDeleteFile = inject<(relPath: string) => void>(
  "askDeleteFile",
  () => {},
);
const askDeleteEntry = inject<(relPath: string, entryId: string) => void>(
  "askDeleteEntry",
  () => {},
);
const askDeleteFolder = inject<(relPath: string) => void>(
  "askDeleteFolder",
  () => {},
);

function onFileClick(relPath: string) {
  if (!fileCollapsed[relPath] && workspace.activePath === relPath) {
    fileCollapsed[relPath] = true;
    return;
  }
  fileCollapsed[relPath] = false;
  openFile(relPath);
}

function onAddEntry(relPath: string) {
  fileCollapsed[relPath] = false;
  addEntry(relPath);
}
</script>

<template>
  <div>
    <div v-for="folder in node.folders" :key="folder.path">
      <div
        class="group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-sidebar-accent"
      >
        <button
          class="flex min-w-0 flex-1 items-center gap-1.5"
          @click="folderCollapsed[folder.path] = !folderCollapsed[folder.path]"
        >
          <ChevronDownIcon
            v-if="!folderCollapsed[folder.path]"
            class="size-3 shrink-0 text-muted-foreground"
          />
          <ChevronRightIcon v-else class="size-3 shrink-0 text-muted-foreground" />
          <FolderIcon class="size-3.5 shrink-0 text-muted-foreground" />
          <span class="truncate font-medium">{{ folder.name }}</span>
        </button>
        <button
          class="hidden text-muted-foreground hover:text-foreground group-hover:block"
          title="New file in this folder"
          @click="askNewFile(`${folder.path}/`)"
        >
          <PlusIcon class="size-3.5" />
        </button>
        <button
          class="hidden text-muted-foreground hover:text-destructive group-hover:block"
          title="Delete folder and its contents"
          @click="askDeleteFolder(folder.path)"
        >
          <Trash2Icon class="size-3.5" />
        </button>
      </div>
      <div v-if="!folderCollapsed[folder.path]" class="ml-3 border-l pl-1.5">
        <SidebarTree :node="folder" />
      </div>
    </div>

    <div v-for="file in node.files" :key="file.rel_path">
      <div
        class="group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-sidebar-accent"
        :class="{
          'bg-sidebar-accent': workspace.activePath === file.rel_path,
        }"
      >
        <button
          class="flex min-w-0 flex-1 items-center gap-1.5"
          @click="onFileClick(file.rel_path)"
        >
          <ChevronDownIcon
            v-if="!fileCollapsed[file.rel_path]"
            class="size-3 shrink-0 text-muted-foreground"
          />
          <ChevronRightIcon v-else class="size-3 shrink-0 text-muted-foreground" />
          <FileCode2Icon class="size-3.5 shrink-0 text-muted-foreground" />
          <span class="truncate font-mono">{{ file.name }}</span>
          <span
            v-if="workspace.models[file.rel_path] && isDirty(workspace.models[file.rel_path])"
            class="size-1.5 shrink-0 rounded-full bg-amber-500"
            title="Unsaved changes"
          />
        </button>
        <button
          class="hidden text-muted-foreground hover:text-foreground group-hover:block"
          title="Add request to this file"
          @click="onAddEntry(file.rel_path)"
        >
          <PlusIcon class="size-3.5" />
        </button>
        <button
          class="hidden text-muted-foreground hover:text-destructive group-hover:block"
          title="Delete file"
          @click="askDeleteFile(file.rel_path)"
        >
          <Trash2Icon class="size-3.5" />
        </button>
      </div>

      <div v-if="!fileCollapsed[file.rel_path]" class="ml-4 border-l pl-1.5">
        <template
          v-if="workspace.models[file.rel_path] && !workspace.models[file.rel_path].raw"
        >
          <div
            v-for="entry in workspace.models[file.rel_path].entries"
            :key="entry.id"
            class="group flex w-full items-center rounded hover:bg-sidebar-accent"
            :class="{
              'bg-sidebar-accent': workspace.activeEntryId === entry.id,
            }"
          >
            <button
              class="flex min-w-0 flex-1 flex-col gap-0.5 px-1.5 py-1 text-left"
              @click="selectEntry(file.rel_path, entry.id)"
            >
              <span class="flex items-center gap-2 text-xs">
                <span
                  class="w-12 shrink-0 font-mono text-[10px] font-bold"
                  :class="METHOD_COLORS[entry.method]"
                >
                  {{ entry.method }}
                </span>
                <span class="truncate font-medium">
                  {{ entry.name || entry.url }}
                </span>
              </span>
              <span class="truncate pl-14 font-mono text-[10px] text-muted-foreground">
                {{ entry.url }}
              </span>
            </button>
            <button
              class="mr-1 hidden text-muted-foreground hover:text-destructive group-hover:block"
              title="Delete request"
              @click="askDeleteEntry(file.rel_path, entry.id)"
            >
              <Trash2Icon class="size-3" />
            </button>
          </div>
          <p
            v-if="workspace.models[file.rel_path].entries.length === 0"
            class="px-1.5 py-1 text-[10px] text-muted-foreground"
          >
            No requests — hover the file and press +
          </p>
        </template>
        <p
          v-else-if="workspace.models[file.rel_path]?.raw"
          class="px-1.5 py-1 text-[10px] text-muted-foreground"
        >
          raw mode
        </p>
      </div>
    </div>
  </div>
</template>
