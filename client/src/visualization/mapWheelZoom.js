export function addMapWheelZoom(container, instance, target) {
  const onWheel = (event) => {
    if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return;

    event.preventDefault();
    event.stopPropagation();

    const bounds = container.getBoundingClientRect();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
    const delta = Math.max(-80, Math.min(80, event.deltaY * unit));
    instance.dispatchAction({
      type: "geoRoam",
      ...target,
      zoom: Math.exp(-delta * 0.001),
      originX: (event.clientX - bounds.left) * container.clientWidth / bounds.width,
      originY: (event.clientY - bounds.top) * container.clientHeight / bounds.height,
    });
  };

  container.addEventListener("wheel", onWheel, { capture: true, passive: false });
  return () => container.removeEventListener("wheel", onWheel, { capture: true });
}
