<script setup lang="ts">
import { computed } from "vue";
import { Loader2Icon, PlayIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { METHOD_COLORS, METHODS } from "@/lib/hurl";
import {
  activeEntry,
  activeModel,
  runEntry,
  setEntryMethod,
  workspace,
} from "@/stores/workspace";

const url = computed({
  get: () => activeEntry.value?.url ?? "",
  set: (v: string) => {
    if (activeEntry.value) activeEntry.value.url = v;
  },
});

function onMethodChange(v: unknown) {
  if (activeEntry.value) setEntryMethod(activeEntry.value, String(v));
}

function send() {
  if (activeModel.value && activeEntry.value) {
    runEntry(activeModel.value.relPath, activeEntry.value);
  }
}
</script>

<template>
  <div v-if="activeEntry" class="flex items-center gap-2 p-2">
    <Select
      :model-value="activeEntry.method"
      @update:model-value="onMethodChange"
    >
      <SelectTrigger class="h-9 w-28 font-mono text-xs font-bold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="m in METHODS"
          :key="m"
          :value="m"
          class="font-mono text-xs font-bold"
          :class="METHOD_COLORS[m]"
        >
          {{ m }}
        </SelectItem>
      </SelectContent>
    </Select>
    <Input
      v-model="url"
      class="h-9 flex-1 font-mono text-xs"
      placeholder="https://api.example.com/endpoint"
      @keydown.enter="send"
    />
    <Button
      class="h-9 gap-1.5 px-4"
      :disabled="workspace.running"
      @click="send"
    >
      <Loader2Icon v-if="workspace.running" class="size-4 animate-spin" />
      <PlayIcon v-else class="size-4" />
      Send
    </Button>
  </div>
</template>
