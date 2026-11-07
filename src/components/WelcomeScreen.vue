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

    <div v-if="workspace.recentWorkspaces.length" class="w-96">
      <p
        class="mb-3 text-center text-base font-semibold tracking-wide"
      >
        Recent workspaces
      </p>
      <div class="rounded-lg border-2">
        <div
          v-for="dir in workspace.recentWorkspaces"
          :key="dir"
          class="group flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-accent"
          @click="openWorkspaceDir(dir)"
        >
          <FolderOpenIcon class="size-5 shrink-0 text-primary" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ dirName(dir) }}</p>
            <p class="truncate font-mono text-xs text-muted-foreground">
              {{ dir }}
            </p>
          </div>
          <button
            class="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-muted"
            title="Remove from list"
            @click.stop="removeRecentWorkspace(dir)"
          >
            <XIcon class="size-3.5" />
          </button>
        </div>
      </div>
    </div>

    <div class="flex gap-2">
      <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" @click="newWorkspace">
        <FolderPlusIcon class="size-3.5" />
        New workspace
      </Button>
      <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" @click="pickWorkspace">
        <FolderOpenIcon class="size-3.5" />
        Open workspace
      </Button>
    </div>
  </div>
</template>
