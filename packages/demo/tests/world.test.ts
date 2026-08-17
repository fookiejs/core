import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bounce, cellOf, cellRoom, cellSize, stepMotion, worldSize } from "../src/world.ts";

describe("cellOf", () => {
  it("maps the origin to cell 0,0", () => {
    assert.deepEqual(cellOf(0, 0), { col: 0, row: 0 });
  });

  it("maps the next cell at the cell size", () => {
    assert.deepEqual(cellOf(cellSize, cellSize), { col: 1, row: 1 });
  });

  it("clamps past the world edge", () => {
    assert.deepEqual(cellOf(worldSize + 40, -20), { col: 2, row: 0 });
  });
});

describe("cellRoom", () => {
  it("names the room from position", () => {
    assert.equal(cellRoom(10, 10), "cell:0,0");
    assert.equal(cellRoom(650, 320), "cell:2,1");
  });
});

describe("bounce", () => {
  it("reflects off the low edge", () => {
    assert.deepEqual(bounce(11, -4, 10, 890), { pos: 10, vel: 4 });
  });

  it("reflects off the high edge", () => {
    assert.deepEqual(bounce(888, 5, 10, 890), { pos: 890, vel: -5 });
  });

  it("advances inside the world", () => {
    assert.deepEqual(bounce(40, 2.5, 10, 890), { pos: 42.5, vel: 2.5 });
  });
});

describe("stepMotion", () => {
  it("turns a corner hit inward", () => {
    const stepped = stepMotion(889, 889, 5, 5, 10, 890, () => 2);
    assert.equal(stepped.x, 890);
    assert.equal(stepped.y, 890);
    assert.equal(stepped.vx, -2);
    assert.equal(stepped.vy, -2);
  });
});
