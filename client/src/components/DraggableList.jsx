import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";

function DraggableList(props) {
  const {
    items,
    getId,
    getOrder,
    onReorder,
    renderItem,
    className,
    orientation,
    highlightClassName,
    draggingClassName,
    wrapperClassName,
  } = props;

  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);

  const orderedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const arr = [...items];
    return arr.sort((a, b) => {
      const aOrder = Number(getOrder(a) ?? 0);
      const bOrder = Number(getOrder(b) ?? 0);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return Number(getId(a)) - Number(getId(b));
    });
  }, [items, getId, getOrder]);

  const _onDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const _onDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  };

  const _computeNewOrder = (dragId, dropId, insertAfter) => {
    const working = orderedItems.filter((it) => getId(it) !== dragId);
    const targetIndex = working.findIndex((it) => getId(it) === dropId) + (insertAfter ? 1 : 0);

    const prev = working[targetIndex - 1];
    const next = working[targetIndex];

    const prevOrder = prev ? Number(getOrder(prev) ?? 0) : null;
    const nextOrder = next ? Number(getOrder(next) ?? 0) : null;

    if (prev && next) return (prevOrder + nextOrder) / 2;
    if (!prev && next) return nextOrder - 1;
    if (prev && !next) return prevOrder + 1;
    return 0;
  };

  const _onDrop = (e, id) => {
    e.preventDefault();
    if (!draggingId || id === draggingId) {
      setOverId(null);
      setDraggingId(null);
      return;
    }

    const dragIndex = orderedItems.findIndex((it) => getId(it) === draggingId);
    const dropIndex = orderedItems.findIndex((it) => getId(it) === id);
    const insertAfter = dragIndex < dropIndex;

    const newOrder = _computeNewOrder(draggingId, id, insertAfter);
    if (newOrder !== null && newOrder !== undefined) {
      onReorder({ dragId: draggingId, dropId: id, newOrder });
    }

    setOverId(null);
    setDraggingId(null);
  };

  const _onDragEnd = () => {
    setOverId(null);
    setDraggingId(null);
  };

  const containerClasses = orientation === "vertical"
    ? `flex flex-col ${className || ""}`
    : `flex flex-row flex-wrap ${className || ""}`;

  return (
    <div className={containerClasses}>
      {orderedItems.map((item) => {
        const id = getId(item);
        const isDragging = draggingId === id;
        const isOver = overId === id && draggingId !== id;

        return (
          <div
            key={id}
            draggable
            onDragStart={(e) => _onDragStart(e, id)}
            onDragOver={(e) => _onDragOver(e, id)}
            onDrop={(e) => _onDrop(e, id)}
            onDragEnd={_onDragEnd}
            className={`transition-transform duration-150 ${isDragging ? (draggingClassName || "opacity-80 scale-[0.98]") : ""} ${isOver ? (highlightClassName || "ring-2 ring-primary/50 rounded-md") : ""} ${wrapperClassName}`}
          >
            {renderItem(item, { isDragging, isOver })}
          </div>
        );
      })}
    </div>
  );
}

DraggableList.propTypes = {
  items: PropTypes.array.isRequired,
  getId: PropTypes.func.isRequired,
  getOrder: PropTypes.func.isRequired,
  onReorder: PropTypes.func.isRequired,
  renderItem: PropTypes.func.isRequired,
  className: PropTypes.string,
  orientation: PropTypes.oneOf(["horizontal", "vertical"]),
  highlightClassName: PropTypes.string,
  draggingClassName: PropTypes.string,
  wrapperClassName: PropTypes.string,
};

DraggableList.defaultProps = {
  className: "gap-2",
  orientation: "horizontal",
  highlightClassName: "ring-2 ring-primary/50 rounded-md",
  draggingClassName: "opacity-80 scale-[0.98]",
  wrapperClassName: "",
};

export default DraggableList;


