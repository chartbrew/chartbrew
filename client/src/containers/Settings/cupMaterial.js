import * as THREE from "three";

export function createCelMaterial() {
  const bands = Uint8Array.from({ length: 256 }, (_, index) => {
    const light = index / 255;
    return 45 + 80 * THREE.MathUtils.smoothstep(light, 0.3, 0.37)
      + 130 * THREE.MathUtils.smoothstep(light, 0.63, 0.7);
  });
  const gradientMap = new THREE.DataTexture(bands, bands.length, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.LinearFilter;
  gradientMap.magFilter = THREE.LinearFilter;
  gradientMap.needsUpdate = true;

  return new THREE.MeshToonMaterial({ color: "#f17041", gradientMap });
}

export function createCelLight(camera) {
  const light = new THREE.DirectionalLight(0xffedce, 2.5);
  light.position.set(-3, 5, 0);
  light.target.position.set(0, 0, -12.5);
  camera.add(light, light.target);
  return light;
}
