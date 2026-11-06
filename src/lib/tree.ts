import type { HurlFileInfo } from "@/types";

export interface TreeFolder {
  name: string;
  /** Path relative to the workspace root ("" for the root itself). */
  path: string;
  folders: TreeFolder[];
  files: HurlFileInfo[];
}

/** Groups the flat file list by its real on-disk folder structure. */
export function buildFileTree(
  files: HurlFileInfo[],
  folders: string[] = [],
): TreeFolder {
  const root: TreeFolder = { name: "", path: "", folders: [], files: [] };
  const ensureFolder = (path: string) => {
    let node = root;
    for (const part of path.split("/")) {
      if (!part) continue;
      let next = node.folders.find((f) => f.name === part);
      if (!next) {
        next = {
          name: part,
          path: node.path ? `${node.path}/${part}` : part,
          folders: [],
          files: [],
        };
        node.folders.push(next);
      }
      node = next;
    }
  };
  for (const folder of folders) ensureFolder(folder);
  for (const file of files) {
    const parts = file.rel_path.split("/");
    let node = root;
    for (const part of parts.slice(0, -1)) {
      let next = node.folders.find((f) => f.name === part);
      if (!next) {
        next = {
          name: part,
          path: node.path ? `${node.path}/${part}` : part,
          folders: [],
          files: [],
        };
        node.folders.push(next);
      }
      node = next;
    }
    node.files.push(file);
  }
  const sortRecursive = (n: TreeFolder) => {
    n.folders.sort((a, b) => a.name.localeCompare(b.name));
    n.files.sort((a, b) => a.name.localeCompare(b.name));
    n.folders.forEach(sortRecursive);
  };
  sortRecursive(root);
  return root;
}
