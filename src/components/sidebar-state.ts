import { reactive, watch } from "vue";
import { workspace } from "@/stores/workspace";

/** Expand/collapse state shared by all recursive SidebarTree instances. */
export const fileCollapsed = reactive<Record<string, boolean>>({});
export const folderCollapsed = reactive<Record<string, boolean>>({});

// keep the active file expanded when selection changes (e.g. via tabs)
watch(
  () => workspace.activePath,
  (path) => {
    if (path) fileCollapsed[path] = false;
  },
);
