<script setup lang="ts">
import { computed, ref } from "vue";
import {
  FileCode2Icon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { METHOD_COLORS } from "@/lib/hurl";
import {
  activeModel,
  addEntry,
  deleteFile,
  isDirty,
  modelContent,
  runFile,
  selectEntry,
  workspace,
} from "@/stores/workspace";

const dirty = computed(() =>
  activeModel.value ? isDirty(activeModel.value) : false,
);

const sizeLabel = computed(() => {
  if (!activeModel.value) return "";
  const bytes = new Blob([modelContent(activeModel.value)]).size;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
});

const confirmDelete = ref(false);

async function onDeleteFile() {
  if (!activeModel.value) return;
  const relPath = activeModel.value.relPath;
  confirmDelete.value = false;
  await deleteFile(relPath);
}
</script>

<template>
  <div v-if="activeModel" class="flex h-full flex-col">
    <div class="flex items-center gap-2 border-b px-3 py-1.5">
      <FileCode2Icon class="size-4 shrink-0 text-muted-foreground" />
      <span class="truncate font-mono text-sm font-medium">
        {{ activeModel.relPath }}
      </span>
      <span
        v-if="dirty"
        class="size-1.5 shrink-0 rounded-full bg-amber-500"
        title="Unsaved changes"
      />
      <span class="ml-auto text-[10px] text-muted-foreground">
        {{ activeModel.entries.length }} request{{
          activeModel.entries.length === 1 ? "" : "s"
        }}
        · {{ sizeLabel }}
      </span>
      <Button
        variant="outline"
        size="sm"
        class="h-7 gap-1.5 text-xs"
        :disabled="workspace.running || activeModel.entries.length === 0"
        title="Run every request in this file"
        @click="runFile(activeModel.relPath)"
      >
        <PlayIcon class="size-3.5" />
        Run file
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-7 text-muted-foreground hover:text-destructive"
        title="Delete file"
        @click="confirmDelete = true"
      >
        <Trash2Icon class="size-3.5" />
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="p-3">
        <div
          v-if="activeModel.entries.length === 0"
          class="flex flex-col items-center gap-2 py-8"
        >
          <p class="text-xs text-muted-foreground">
            This file has no requests yet.
          </p>
          <Button
            variant="outline"
            size="sm"
            class="h-7 gap-1.5 text-xs"
            @click="addEntry(activeModel.relPath)"
          >
            <PlusIcon class="size-3.5" />
            Add entry
          </Button>
        </div>
        <button
          v-for="(entry, i) in activeModel.entries"
          :key="entry.id"
          class="group mb-1 flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left hover:bg-accent/50"
          @click="selectEntry(activeModel.relPath, entry.id)"
        >
          <span class="w-6 shrink-0 font-mono text-[10px] text-muted-foreground">
            {{ i + 1 }}
          </span>
          <span
            class="w-16 shrink-0 font-mono text-xs font-bold"
            :class="METHOD_COLORS[entry.method]"
          >
            {{ entry.method }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">
              {{ entry.name || entry.url }}
            </span>
            <span class="block truncate font-mono text-[10px] text-muted-foreground">
              {{ entry.url }}
            </span>
          </span>
        </button>
      </div>
    </ScrollArea>

    <Dialog v-model:open="confirmDelete">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete file</DialogTitle>
          <DialogDescription>
            Permanently delete
            <span class="font-mono">{{ activeModel.relPath }}</span> from disk?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="confirmDelete = false">
            Cancel
          </Button>
          <Button variant="destructive" size="sm" @click="onDeleteFile">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
