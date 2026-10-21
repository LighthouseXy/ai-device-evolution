import fs from "node:fs";
import { validateDeviceRecords } from "./lib/validate-device-records.mjs";
const args = process.argv.slice(2);
if (args.length > 1) throw new Error("Usage: node scripts/validate-data.mjs [database.json]");
const result = validateDeviceRecords(JSON.parse(fs.readFileSync(args[0] ?? "src/data/devices-db.json", "utf8")));
console.log(JSON.stringify(result));
