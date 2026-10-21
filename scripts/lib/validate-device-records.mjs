import assert from "node:assert/strict";
import { loadTsModule } from "./load-ts-module.mjs";
import { isValidObservationDate } from "./price-date.mjs";

const { deviceCategories } = loadTsModule("@/lib/device-categories");
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = value => typeof value === "string" && value.trim().length > 0;

// Common DbDevice/SpecField boundary checks; dataset-specific evidence gates remain separate.
export function validateDeviceRecords(database) {
  assert.ok(object(database) && Array.isArray(database.devices), "devices must be an array");
  assert.ok(database.devices.length > 0, "devices must not be empty");
  const ids = new Set();
  for (const device of database.devices) {
    assert.ok(object(device), "device must be an object");
    for (const key of ["id", "brand", "market", "series", "family", "variant", "modelName", "generation", "comparisonGroupId"]) {
      assert.ok(nonempty(device[key]), `invalid device ${key}`);
    }
    assert.ok(!ids.has(device.id), "duplicate device id");
    ids.add(device.id);
    assert.ok(deviceCategories.includes(device.category), "invalid category");
    assert.ok(Number.isInteger(device.releaseYear) && device.releaseYear >= 1970 && device.releaseYear <= 2100, "invalid releaseYear");
    assert.ok(Number.isInteger(device.generationOrder) && device.generationOrder > 0, "invalid generationOrder");
    assert.ok((device.computed === undefined || object(device.computed)) && object(device.specs), "computed/specs must be objects");
    for (const field of Object.values(device.specs)) {
      assert.ok(object(field) && Object.hasOwn(field, "value"), "invalid SpecField");
      assert.ok(field.value === null || ["string", "number", "boolean"].includes(typeof field.value) || (Array.isArray(field.value) && field.value.every(nonempty)), "invalid field value");
      assert.ok(typeof field.value !== "number" || Number.isFinite(field.value), "invalid numeric value");
      assert.ok(["official", "reference"].includes(field.sourceType), "invalid sourceType");
      assert.ok(typeof field.confidence === "number" && Number.isFinite(field.confidence) && field.confidence >= 0 && field.confidence <= 1, "invalid confidence");
      assert.ok(isValidObservationDate(field.verifiedAt), "invalid verifiedAt");
      const url = new URL(field.sourceUrl);
      assert.equal(url.protocol, "https:", "source must be HTTPS");
      assert.ok(!url.username && !url.password, "source URL must not contain credentials");
    }
  }
  return { records: database.devices.length, categories: [...new Set(database.devices.map(device => device.category))] };
}
