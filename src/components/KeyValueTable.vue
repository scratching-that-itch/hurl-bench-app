<script setup lang="ts">
import { PlusIcon, Trash2Icon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { kv } from "@/stores/workspace";
import type { KeyValue } from "@/types";

const props = defineProps<{
  items: KeyValue[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}>();

function addRow() {
  props.items.push(kv());
}

function removeRow(id: string) {
  const idx = props.items.findIndex((i) => i.id === id);
  if (idx !== -1) props.items.splice(idx, 1);
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-for="item in items"
      :key="item.id"
      class="group flex items-center gap-2"
    >
      <input
        v-model="item.enabled"
        type="checkbox"
        class="size-3.5 shrink-0 accent-primary"
      />
      <Input
        v-model="item.key"
        :placeholder="keyPlaceholder ?? 'key'"
        class="h-8 flex-1 font-mono text-xs"
      />
      <Input
        v-model="item.value"
        :placeholder="valuePlaceholder ?? 'value'"
        class="h-8 flex-[2] font-mono text-xs"
      />
      <Button
        variant="ghost"
        size="icon"
        class="size-7 opacity-0 group-hover:opacity-100"
        @click="removeRow(item.id)"
      >
        <Trash2Icon class="size-3.5" />
      </Button>
    </div>
    <Button
      variant="outline"
      size="sm"
      class="mt-1 w-fit gap-1.5"
      @click="addRow"
    >
      <PlusIcon class="size-3.5" />
      {{ addLabel ?? "Add" }}
    </Button>
  </div>
</template>
