<script setup lang="ts">
import {
  FolderOpenIcon,
  FolderPlusIcon,
  TerminalIcon,
  XIcon,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  newWorkspace,
  openWorkspaceDir,
  pickWorkspace,
  removeRecentWorkspace,
  workspace,
} from "@/stores/workspace";

function dirName(path: string): string {
  return path.replace(/\/+$/, "").split("/").pop() || path;
}
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-6 p-8">
    <div class="flex flex-col items-center gap-2">
      <TerminalIcon class="size-10 text-primary" />
      <h1 class="text-lg font-semibold">Hurl Bench</h1>
      <p class="text-xs text-muted-foreground">
        Design and run .hurl files — pick a workspace to get started
      </p>
    </div>

    <div class="flex gap-2">
      <Button size="sm" class="gap-1.5" @click="newWorkspace">
        <FolderPlusIcon class="size-3.5" />
        New workspace
      </Button>
      <Button variant="outline" size="sm" class="gap-1.5" @click="pickWorkspace">
        <FolderOpenIcon class="size-3.5" />
        Open workspace
      </Button>
    </div>

    <div v-if="workspace.recentWorkspaces.length" class="w-80">
      <p
        class="mb-1.5 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Recent workspaces
      </p>
      <div class="rounded-md border">
        <div
          v-for="dir in workspace.recentWorkspaces"
          :key="dir"
          class="group flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-0 hover:bg-accent"
          @click="openWorkspaceDir(dir)"
        >
          <FolderOpenIcon class="size-3.5 shrink-0 text-muted-foreground" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-medium">{{ dirName(dir) }}</p>
            <p class="truncate font-mono text-[10px] text-muted-foreground">
              {{ dir }}
            </p>
          </div>
          <button
            class="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted"
            title="Remove from list"
            @click.stop="removeRecentWorkspace(dir)"
          >
            <XIcon class="size-3" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
