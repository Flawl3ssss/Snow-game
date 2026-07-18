import { describe, expect, it } from "vitest";
import { Mesh } from "three";
import {
  createBoostPadModel,
  createDirectionSign,
  createFenceSection,
  createPremiumMaterials,
  createRockModel,
  createSlingshotPost,
  createSnowflakeModel,
} from "./WorldModels";

const meshCount = (root: ReturnType<typeof createSnowflakeModel>): number => {
  let count = 0;
  root.traverse((object) => {
    if (object instanceof Mesh) count += 1;
  });
  return count;
};

describe("premium world models", () => {
  const materials = createPremiumMaterials();

  it("builds articulated models instead of single primitive placeholders", () => {
    expect(meshCount(createSnowflakeModel(materials))).toBe(16);
    expect(meshCount(createBoostPadModel(materials))).toBe(7);
    expect(meshCount(createRockModel(materials, 1))).toBe(2);
    expect(meshCount(createDirectionSign(-1, materials))).toBe(4);
    expect(meshCount(createFenceSection(materials))).toBe(4);
    expect(meshCount(createSlingshotPost(-1, materials))).toBe(3);
  });

  it("keeps interactive model roots centered for collision placement", () => {
    for (const model of [
      createSnowflakeModel(materials),
      createBoostPadModel(materials),
      createRockModel(materials, 0),
    ]) {
      expect(model.position.toArray()).toEqual([0, 0, 0]);
      expect(model.rotation.x).toBe(0);
      expect(model.rotation.y).toBe(0);
      expect(model.rotation.z).toBe(0);
    }
  });
});
