// Writes model.schema.json so editors and other languages can validate model.json.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { model_definition_schema } from "../src/model_definition_schema.ts";

const output_path = fileURLToPath(new URL("../model.schema.json", import.meta.url));
const json_schema = z.toJSONSchema(model_definition_schema, { io: "input" });
writeFileSync(output_path, `${JSON.stringify(json_schema, null, 2)}\n`);
console.log(`Wrote ${output_path}`);
