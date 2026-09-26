// Run: node --test src/lib/remoteCursorMap.test.mjs   (Node strips the TS types)
import test from "node:test";
import assert from "node:assert/strict";
import { mapIndexThroughChange as map } from "./remoteCursorMap.ts";

test("insertion before the cursor shifts it right by the inserted length", () => {
  assert.equal(map("Hello World", "Hi Hello World", 8), 11); // 'W' index 6+... cursor after "Hello Wo"
  assert.equal(map("abc", "Xabc", 3), 4);
});

test("deletion before the cursor shifts it left", () => {
  assert.equal(map("Hello World", "World", 11), 5); // end of doc
  assert.equal(map("Hello World", "Hello", 5), 5); // cursor right at the cut stays
});

test("Enter above the cursor moves it to the next line index (+1)", () => {
  assert.equal(map("line1\nline2", "line1\n\nline2", 9), 10);
});

test("cursor before the change is untouched", () => {
  assert.equal(map("Hello World", "Hello World!", 3), 3);
  assert.equal(map("a\nb\nc", "a\nb\nc\nd", 0), 0);
});

test("cursor inside a replaced region lands at the end of the new region, never out of range", () => {
  const out = map("foo BAR baz", "foo X baz", 6);
  assert.equal(out, 5);
  assert.ok(out >= 0 && out <= "foo X baz".length);
});

test("multiline change before the cursor", () => {
  const oldT = "a\nb\nc\nd";
  const newT = "a\nB\nB2\nB3\nc\nd";
  assert.equal(map(oldT, newT, oldT.length), newT.length);
});

test("empty document: every cursor clamps to 0 without going negative", () => {
  assert.equal(map("Hello World", "", 5), 0);
  assert.equal(map("Hello World", "", 11), 0);
  assert.equal(map("Hello World", "", 0), 0);
});

test("from empty: nothing to map, clamps to the new length", () => {
  assert.equal(map("", "Hello", 0), 0);
  assert.equal(map("", "Hello", 3), 5); // shifted past the insertion, clamped to the new length
});

test("identical text is a no-op", () => {
  assert.equal(map("same", "same", 2), 2);
});
