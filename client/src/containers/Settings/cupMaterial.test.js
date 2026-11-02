import assert from "node:assert/strict";
import { test } from "node:test";
import { LinearFilter, PerspectiveCamera, RedFormat, Vector3 } from "three";
import { createCelLight, createCelMaterial } from "./cupMaterial.js";

test("cup cel shading keeps flat bands with gradual transitions and view-relative light", () => {
  const material = createCelMaterial();
  const texture = material.gradientMap;
  assert.equal(material.isMeshToonMaterial, true);
  assert.equal(material.color.getHexString(), "f17041");
  assert.equal(texture.image.width, 256);
  assert.equal(texture.image.height, 1);
  assert.equal(texture.format, RedFormat);
  assert.equal(texture.minFilter, LinearFilter);
  assert.equal(texture.magFilter, LinearFilter);
  const bands = [...texture.image.data];
  assert.deepEqual([bands[0], bands[128], bands[255]], [45, 125, 255]);
  assert.ok(bands.filter((value) => [45, 125, 255].includes(value)).length > 200);
  for (let index = 1; index < bands.length; index += 1) {
    assert.ok(bands[index] >= bands[index - 1]);
    assert.ok(bands[index] - bands[index - 1] <= 12, "Shade changes must not jump between bands");
  }
  const camera = new PerspectiveCamera();
  const light = createCelLight(camera);
  let firstDirection;
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    camera.position.set(Math.sin(angle) * 12.5, 0.4, Math.cos(angle) * 12.5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const direction = light.getWorldPosition(new Vector3())
      .sub(light.target.getWorldPosition(new Vector3()))
      .transformDirection(camera.matrixWorldInverse);
    firstDirection ??= direction.clone();
    assert.ok(direction.distanceTo(firstDirection) < 1e-10, "Light direction must stay stable through a full orbit");
  }
  texture.dispose();
  material.dispose();
  light.dispose();
});
