<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { InboxIcon } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { METHOD_COLORS } from "@/lib/hurl";
import { prettyBody } from "@/lib/runner";
import { latestRun } from "@/stores/workspace";
import type { HttpMethod } from "@/types";

const selectedIndex = ref(0);

watch(latestRun, (run) => {
  selectedIndex.value = run?.responses.length ? run.responses.length - 1 : 0;
});

const selected = computed(
  () => latestRun.value?.responses[selectedIndex.value] ?? null,
);

function statusClass(status: number | null) {
  if (status == null) return "bg-muted text-muted-foreground";
  if (status < 300) return "bg-emerald-600/15 text-emerald-500 border-emerald-600/30";
  if (status < 400) return "bg-sky-600/15 text-sky-500 border-sky-600/30";
  if (status < 500) return "bg-amber-600/15 text-amber-500 border-amber-600/30";
  return "bg-rose-600/15 text-rose-500 border-rose-600/30";
}

const body = computed(() =>
  selected.value ? prettyBody(selected.value.body) : "",
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      class="flex h-9 shrink-0 items-center gap-3 border-b px-3 text-xs text-muted-foreground"
    >
      <span class="font-semibold tracking-wide uppercase">Response</span>
      <template v-if="latestRun">
        <Badge variant="outline" class="font-mono" :class="statusClass(selected?.status ?? null)">
          {{ selected?.status ?? "—" }}
        </Badge>
        <span v-if="selected?.version" class="font-mono">
          {{ selected.version }}
        </span>
        <span class="font-mono">{{ latestRun.durationMs }} ms</span>
        <Badge
          v-if="latestRun.exitCode !== 0"
          variant="destructive"
          class="font-mono"
        >
          exit {{ latestRun.exitCode }}
        </Badge>
        <span class="ml-auto font-mono text-[10px]">
          {{ new Date(latestRun.startedAt).toLocaleTimeString() }}
        </span>
      </template>
    </div>

    <template v-if="latestRun">
      <div
        v-if="latestRun.responses.length > 1"
        class="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5"
      >
        <button
          v-for="(resp, i) in latestRun.responses"
          :key="i"
          class="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px]"
          :class="
            selectedIndex === i
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-muted/60'
          "
          @click="selectedIndex = i"
        >
          <span class="text-muted-foreground">{{ i + 1 }}.</span>
          <span
            class="font-bold"
            :class="METHOD_COLORS[(resp.method as HttpMethod)] ?? ''"
          >
            {{ resp.method }}
          </span>
          <span class="max-w-48 truncate">{{ resp.url }}</span>
          <span
            class="rounded px-1"
            :class="statusClass(resp.status)"
          >
            {{ resp.status ?? "—" }}
          </span>
        </button>
      </div>

      <Tabs default-value="body" class="flex min-h-0 flex-1 flex-col">
        <TabsList class="mx-2 mt-1 w-fit bg-transparent">
          <TabsTrigger value="body" class="text-xs">Body</TabsTrigger>
          <TabsTrigger value="headers" class="text-xs">
            Headers
            <span v-if="selected" class="ml-1 text-muted-foreground">
              {{ selected.headers.length }}
            </span>
          </TabsTrigger>
          <TabsTrigger value="raw" class="text-xs">Raw Output</TabsTrigger>
        </TabsList>
        <ScrollArea class="min-h-0 flex-1">
          <div class="p-3">
            <TabsContent value="body" class="mt-0">
              <pre
                v-if="selected"
                class="font-mono text-xs whitespace-pre-wrap"
              >{{ body }}</pre>
              <p v-else class="text-xs text-muted-foreground">
                No response captured for this run.
              </p>
            </TabsContent>
            <TabsContent value="headers" class="mt-0">
              <table v-if="selected" class="w-full text-xs">
                <tbody>
                  <tr
                    v-for="h in selected.headers"
                    :key="h.name + h.value"
                    class="border-b border-border/50 last:border-0"
                  >
                    <td class="py-1 pr-4 font-mono font-medium">{{ h.name }}</td>
                    <td class="py-1 font-mono break-all text-muted-foreground">
                      {{ h.value }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </TabsContent>
            <TabsContent value="raw" class="mt-0">
              <pre
                v-if="latestRun.stderr"
                class="mb-2 font-mono text-xs whitespace-pre-wrap text-rose-400"
              >{{ latestRun.stderr }}</pre>
              <pre
                v-if="latestRun.stdout"
                class="mb-2 font-mono text-xs whitespace-pre-wrap"
              >{{ latestRun.stdout }}</pre>
              <pre
                class="font-mono text-xs whitespace-pre-wrap text-muted-foreground"
              >{{ latestRun.report || "(no report)" }}</pre>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </template>

    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground"
    >
      <InboxIcon class="size-8" />
      <p class="text-xs">Hit Send to run the request with hurl</p>
    </div>
  </div>
</template>
