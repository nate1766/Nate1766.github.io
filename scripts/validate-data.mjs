import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const unitsPath = resolve("src/shared/data/units.json");
const data = JSON.parse(readFileSync(unitsPath, "utf-8"));

if (!Array.isArray(data.units) || data.units.length === 0) {
  throw new Error("units.json must contain at least one unit in units[]");
}

for (const unit of data.units) {
  const required = ["id", "hp", "speed", "vision", "attack", "cost", "buildTime"];
  for (const key of required) {
    if (!(key in unit)) {
      throw new Error(`Missing ${key} in units.json entry`);
    }
  }
}

console.log(`Validated ${data.units.length} units.`);
