/**
 * Joins a folder and a path taken from a model file. Rejects absolute paths and
 * ".." so a downloaded model cannot point the app at files outside its folder.
 */
export function join_safe_relative_path(base_path: string, relative_path: string): string {
  const normalized_path = relative_path.replace(/\\/g, "/");
  const path_segments = normalized_path.split("/");
  const is_absolute = normalized_path.startsWith("/") || /^[A-Za-z]:/.test(normalized_path);
  if (is_absolute || path_segments.includes("..")) {
    throw new Error(`Unsafe path in model file: ${relative_path}`);
  }
  const clean_segments = path_segments.filter((segment) => segment !== "" && segment !== ".");
  return `${base_path.replace(/[\\/]+$/, "")}/${clean_segments.join("/")}`;
}
