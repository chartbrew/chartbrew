import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";

import mark from "../../assets/chartbrew-mark.svg";
import markSource from "../../assets/chartbrew-mark.svg?raw";
import { createCelLight, createCelMaterial } from "./cupMaterial";

function AboutCup() {
  const canvasRef = useRef(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      setUnavailable(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const outline = new OutlineEffect(renderer, {
      defaultThickness: 0.003,
      defaultColor: [0.09, 0.035, 0.02],
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(2.6, 0.4, 12.23);
    camera.lookAt(0, 0, 0);
    createCelLight(camera);
    scene.add(camera, new THREE.HemisphereLight(0xfff4e4, 0x8b4530, 0.35));
    const cup = new THREE.Group();
    const silhouette = new THREE.Group();
    silhouette.scale.set(0.008, -0.008, 0.008);
    cup.add(silhouette);
    scene.add(cup);
    const material = createCelMaterial();
    const paths = new SVGLoader().parse(markSource.replace(/ style="[^"]*"/g, "")).paths;
    const bars = [];
    paths.forEach((path, index) => {
      const geometry = new THREE.ExtrudeGeometry(path.toShapes(), {
        depth: 48,
        bevelEnabled: true,
        bevelSegments: 8,
        steps: 1,
        bevelSize: 6,
        bevelOffset: -6,
        bevelThickness: 10,
        curveSegments: 32,
      });
      geometry.computeBoundingBox();
      const base = index < 3 ? geometry.boundingBox.max.y : 304.5;
      geometry.translate(-288.5, -base, -24);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = base - 304.5;
      silhouette.add(mesh);
      if (index < 3) bars.push(mesh);
    });

    let elapsed = 0;
    let previous = null;
    let lost = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const render = () => {
      if (lost) return;
      cup.rotation.set(
        Math.sin(elapsed) * 0.04,
        Math.sin(elapsed * 0.7) * 0.06,
        Math.sin(elapsed * 0.85) * 0.025
      );
      bars.forEach((bar, index) => {
        bar.scale.y = 1 + Math.sin(elapsed * 1.35 + index * 1.4) * 6 / 125;
      });
      outline.render(scene, camera);
    };
    const frame = (now) => {
      if (previous !== null) elapsed += Math.min((now - previous) / 1000, 0.05);
      previous = now;
      render();
    };
    const updatePlayback = () => {
      previous = null;
      renderer.setAnimationLoop(!lost && !reduced.matches && !document.hidden ? frame : null);
      render();
    };
    const resize = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    });
    const onContextLost = () => {
      lost = true;
      renderer.setAnimationLoop(null);
      setUnavailable(true);
    };
    resize.observe(canvas);
    reduced.addEventListener("change", updatePlayback);
    document.addEventListener("visibilitychange", updatePlayback);
    canvas.addEventListener("webglcontextlost", onContextLost);
    updatePlayback();

    return () => {
      resize.disconnect();
      reduced.removeEventListener("change", updatePlayback);
      document.removeEventListener("visibilitychange", updatePlayback);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      renderer.setAnimationLoop(null);
      silhouette.children.forEach((mesh) => mesh.geometry.dispose());
      material.gradientMap.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-96">
      {unavailable ? (
        <div className="flex aspect-square items-center justify-center">
          <img alt="Chartbrew cup" className="w-3/5" src={mark} />
        </div>
      ) : (
        <canvas aria-label="Chartbrew cup in 3D" className="block aspect-square w-full" ref={canvasRef} role="img" />
      )}
    </div>
  );
}

export default AboutCup;
