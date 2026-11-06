<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { HistoryIcon, PlusIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import KeyValueTable from "@/components/KeyValueTable.vue";
import { listHistoryFiles, readHurlFile } from "@/lib/files";
import { serializeEntry } from "@/lib/hurl";
import type { HistoryFileInfo } from "@/types";
import {
  activeEntry,
  activeModel,
  addEntry,
  workspace,
} from "@/stores/workspace";

const rawHurl = computed(() =>
  activeEntry.value ? serializeEntry(activeEntry.value) : "",
);

const showHistory = ref(false);
const historyFiles = ref<HistoryFileInfo[]>([]);
const historyContent = ref<string | null>(null);
const selectedHistoryPath = ref<string | null>(null);

/** Runs of the active entry only; whole-file list when no entry is active. */
const visibleHistory = computed(() => {
  const entry = activeEntry.value;
  if (!entry) return historyFiles.value;
  return historyFiles.value.filter((f) => f.entry === entry.name);
});

watch(
  () => activeModel.value?.relPath,
  () => {
    showHistory.value = false;
    historyContent.value = null;
    selectedHistoryPath.value = null;
  },
);

async function openHistory() {
  if (showHistory.value) {
    showHistory.value = false;
    return;
  }
  showHistory.value = true;
  historyContent.value = null;
  selectedHistoryPath.value = null;
  const dir = workspace.workspaceDir;
  if (!dir || !activeModel.value) return;
  try {
    historyFiles.value = await listHistoryFiles(dir, activeModel.value.relPath);
  } catch {
    historyFiles.value = [];
  }
}

function formatHistoryTime(name: string): string {
  const m = name.match(/\.(\d{8})-(\d{6})-(\d{3})\.history\.txt$/);
  if (!m) return name;
  const [, d, t, ms] = m;
  const date = new Date(
    Number(d.slice(0, 4)),
    Number(d.slice(4, 6)) - 1,
    Number(d.slice(6, 8)),
    Number(t.slice(0, 2)),
    Number(t.slice(2, 4)),
    Number(t.slice(4, 6)),
    Number(ms),
  );
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

async function viewHistory(path: string) {
  selectedHistoryPath.value = path;
  try {
    historyContent.value = await readHurlFile(path);
  } catch (e) {
    historyContent.value = `Could not read history file: ${e}`;
  }
}

const kvCount = (items: { enabled: boolean; key: string }[]) =>
  items.filter((i) => i.enabled && i.key.trim() !== "").length;
</script>

<template>
  <div v-if="activeModel" class="flex h-full flex-col">
    <div class="flex items-center gap-2 border-b px-3 py-1.5">
      <template v-if="!activeModel.raw && activeEntry">
        <Input
          v-model="activeEntry.name"
          class="h-7 flex-1 border-none bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
          placeholder="Request name"
        />
      </template>
      <span v-else class="flex-1 px-1 text-sm font-medium">
        {{ activeModel.relPath }}
        <span class="ml-2 text-xs font-normal text-muted-foreground">
          raw mode — this file uses hurl syntax beyond the designer
        </span>
      </span>
      <Button
        :variant="showHistory ? 'default' : 'ghost'"
        size="sm"
        class="h-7 gap-1.5 text-xs"
        title="Run history for this file"
        @click="openHistory"
      >
        <HistoryIcon class="size-3.5" />
        History
      </Button>
    </div>

    <div v-if="showHistory" class="flex min-h-0 flex-1">
      <div class="flex w-64 shrink-0 flex-col border-r">
        <div
          class="border-b px-3 py-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Runs — latest first
        </div>
        <ScrollArea class="min-h-0 flex-1">
          <p
            v-if="visibleHistory.length === 0"
            class="p-4 text-center text-xs text-muted-foreground"
          >
            {{
              activeEntry
                ? "No history for this request yet — send it first."
                : "No history yet — run a request first."
            }}
          </p>
          <button
            v-for="f in visibleHistory"
            :key="f.path"
            class="block w-full border-b px-3 py-2 text-left hover:bg-accent/50"
            :class="selectedHistoryPath === f.path ? 'bg-accent' : ''"
            @click="viewHistory(f.path)"
          >
            <span class="block text-xs">{{ formatHistoryTime(f.name) }}</span>
            <span
              class="block truncate font-mono text-[10px] text-muted-foreground"
              >{{ f.name }}</span
            >
          </button>
        </ScrollArea>
      </div>
      <ScrollArea class="min-w-0 flex-1">
        <pre
          v-if="historyContent !== null"
          class="p-3 font-mono text-xs whitespace-pre-wrap"
        >{{ historyContent }}</pre>
        <div
          v-else
          class="flex h-full items-center justify-center p-4 text-xs text-muted-foreground"
        >
          Select a run from the list.
        </div>
      </ScrollArea>
    </div>

    <div v-else-if="activeModel.raw" class="min-h-0 flex-1 p-3">
      <Textarea
        v-model="activeModel.rawContent"
        class="h-full min-h-48 font-mono text-xs"
        spellcheck="false"
      />
    </div>

    <template v-else-if="activeEntry">
      <Tabs default-value="params" class="flex min-h-0 flex-1 flex-col">
        <TabsList class="mx-2 mt-1 w-fit bg-transparent">
          <TabsTrigger value="params" class="gap-1 text-xs">
            Params
            <span
              v-if="kvCount(activeEntry.queryParams)"
              class="rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground"
              >{{ kvCount(activeEntry.queryParams) }}</span
            >
          </TabsTrigger>
          <TabsTrigger value="headers" class="gap-1 text-xs">
            Headers
            <span
              v-if="kvCount(activeEntry.headers)"
              class="rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground"
              >{{ kvCount(activeEntry.headers) }}</span
            >
          </TabsTrigger>
          <TabsTrigger value="body" class="text-xs">Body</TabsTrigger>
          <TabsTrigger value="asserts" class="gap-1 text-xs">
            Asserts
            <span
              v-if="kvCount(activeEntry.asserts)"
              class="rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground"
              >{{ kvCount(activeEntry.asserts) }}</span
            >
          </TabsTrigger>
          <TabsTrigger value="raw" class="text-xs">Raw Hurl</TabsTrigger>
        </TabsList>
        <ScrollArea class="min-h-0 flex-1">
          <div class="p-3">
            <TabsContent value="params" class="mt-0">
              <KeyValueTable
                :items="activeEntry.queryParams"
                key-placeholder="param"
                add-label="Add param"
              />
            </TabsContent>
            <TabsContent value="headers" class="mt-0">
              <KeyValueTable
                :items="activeEntry.headers"
                key-placeholder="Header"
                value-placeholder="Value"
                add-label="Add header"
              />
            </TabsContent>
            <TabsContent value="body" class="mt-0">
              <Textarea
                v-model="activeEntry.body"
                class="min-h-48 font-mono text-xs"
                placeholder='{ "json": "body" }'
              />
            </TabsContent>
            <TabsContent value="asserts" class="mt-0">
              <KeyValueTable
                :items="activeEntry.asserts"
                key-placeholder='status / jsonpath "$.id" / header "Content-Type"'
                value-placeholder='== 200 / exists / contains "json"'
                add-label="Add assert"
              />
            </TabsContent>
            <TabsContent value="raw" class="mt-0">
              <pre
                class="rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap"
              >{{ rawHurl }}</pre>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </template>

    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <p class="text-xs">This file has no requests yet</p>
      <Button
        variant="outline"
        size="sm"
        class="gap-1.5"
        @click="addEntry(activeModel.relPath)"
      >
        <PlusIcon class="size-3.5" />
        Add request
      </Button>
    </div>
  </div>

  <div
    v-else
    class="flex h-full items-center justify-center text-sm text-muted-foreground"
  >
    Open a .hurl file from the sidebar
  </div>
</template>
