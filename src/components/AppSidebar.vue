<script setup lang="ts">
import { computed, provide, ref } from "vue";
import {
  FilePlus2Icon,
  FolderOpenIcon,
  FolderPlusIcon,
  RefreshCwIcon,
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import SidebarTree from "@/components/SidebarTree.vue";
import { buildFileTree } from "@/lib/tree";
import {
  deleteFile,
  deleteFolder,
  newFile,
  newFolder,
  pickWorkspace,
  refreshFiles,
  workspace,
} from "@/stores/workspace";

const tree = computed(() =>
  buildFileTree(workspace.files, workspace.folders),
);

const showNewFile = ref(false);
const newFileName = ref("");

function askNewFile(prefill: string) {
  newFileName.value = prefill;
  showNewFile.value = true;
}
provide("askNewFile", askNewFile);

async function submitNewFile() {
  const name = newFileName.value.trim();
  if (!name) return;
  showNewFile.value = false;
  newFileName.value = "";
  await newFile(name);
}

const showNewFolder = ref(false);
const newFolderName = ref("");

async function submitNewFolder() {
  const name = newFolderName.value.trim();
  if (!name) return;
  showNewFolder.value = false;
  newFolderName.value = "";
  await newFolder(name);
}

const fileToDelete = ref<string | null>(null);
provide("askDeleteFile", (relPath: string) => {
  fileToDelete.value = relPath;
});

async function confirmDeleteFile() {
  if (!fileToDelete.value) return;
  const relPath = fileToDelete.value;
  fileToDelete.value = null;
  await deleteFile(relPath);
}

const folderToDelete = ref<string | null>(null);
provide("askDeleteFolder", (relPath: string) => {
  folderToDelete.value = relPath;
});

async function confirmDeleteFolder() {
  if (!folderToDelete.value) return;
  const relPath = folderToDelete.value;
  folderToDelete.value = null;
  await deleteFolder(relPath);
}
</script>

<template>
  <div class="flex h-full flex-col bg-sidebar text-sidebar-foreground">
    <div class="flex h-10 items-center justify-between border-b px-3">
      <span class="text-xs font-semibold tracking-wide uppercase">Files</span>
      <div class="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          class="size-6"
          title="New .hurl file"
          :disabled="!workspace.workspaceDir"
          @click="askNewFile('')"
        >
          <FilePlus2Icon class="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-6"
          title="Refresh files"
          :disabled="!workspace.workspaceDir"
          @click="refreshFiles"
        >
          <RefreshCwIcon class="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-6"
          title="New folder"
          :disabled="!workspace.workspaceDir"
          @click="showNewFolder = true"
        >
          <FolderPlusIcon class="size-3.5" />
        </Button>
      </div>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div v-if="!workspace.workspaceDir" class="p-4 text-center">
        <p class="mb-3 text-xs text-muted-foreground">
          Pick a folder with your <code>.hurl</code> files
        </p>
        <Button size="sm" class="gap-1.5" @click="pickWorkspace">
          <FolderOpenIcon class="size-3.5" />
          Open workspace
        </Button>
      </div>

      <p
        v-else-if="workspace.files.length === 0 && workspace.folders.length === 0"
        class="p-4 text-center text-xs text-muted-foreground"
      >
        No .hurl files yet — create one with the + button
      </p>

      <div v-else class="p-1.5">
        <SidebarTree :node="tree" />
      </div>
    </ScrollArea>

    <Dialog v-model:open="showNewFile">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New hurl file</DialogTitle>
          <DialogDescription>
            Relative path inside the workspace, e.g. api/users.hurl — folders
            are created as needed
          </DialogDescription>
        </DialogHeader>
        <Input
          v-model="newFileName"
          class="font-mono text-xs"
          placeholder="api/users.hurl"
          autofocus
          @keydown.enter="submitNewFile"
        />
        <DialogFooter>
          <Button size="sm" :disabled="!newFileName.trim()" @click="submitNewFile">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showNewFolder">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Relative path inside the workspace, e.g. api/v2 — nested folders
            are created as needed
          </DialogDescription>
        </DialogHeader>
        <Input
          v-model="newFolderName"
          class="font-mono text-xs"
          placeholder="api/v2"
          autofocus
          @keydown.enter="submitNewFolder"
        />
        <DialogFooter>
          <Button
            size="sm"
            :disabled="!newFolderName.trim()"
            @click="submitNewFolder"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      :open="fileToDelete !== null"
      @update:open="(v) => { if (!v) fileToDelete = null; }"
    >
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete file</DialogTitle>
          <DialogDescription>
            Permanently delete
            <span class="font-mono">{{ fileToDelete }}</span> from disk?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="fileToDelete = null">
            Cancel
          </Button>
          <Button variant="destructive" size="sm" @click="confirmDeleteFile">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      :open="folderToDelete !== null"
      @update:open="(v) => { if (!v) folderToDelete = null; }"
    >
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete folder</DialogTitle>
          <DialogDescription>
            Permanently delete
            <span class="font-mono">{{ folderToDelete }}</span>
            and everything inside it (files, subfolders, history) from disk?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="folderToDelete = null">
            Cancel
          </Button>
          <Button variant="destructive" size="sm" @click="confirmDeleteFolder">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
