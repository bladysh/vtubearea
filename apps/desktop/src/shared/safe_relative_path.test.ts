import { describe, expect, it } from "vitest";
import { join_safe_relative_path } from "./safe_relative_path";

describe("join_safe_relative_path", () => {
  it("joins normal relative paths", () => {
    expect(join_safe_relative_path("/models/lumi/", "./textures\\face.svg")).toBe("/models/lumi/textures/face.svg");
  });

  it("rejects paths that escape the model folder", () => {
    expect(() => join_safe_relative_path("/models/lumi", "../secret.png")).toThrow();
    expect(() => join_safe_relative_path("/models/lumi", "/etc/passwd")).toThrow();
    expect(() => join_safe_relative_path("/models/lumi", "C:/Windows/file.png")).toThrow();
  });
});
