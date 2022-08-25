import React, { useLayoutEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDrag, useDrop } from "react-dnd";
import { Spacer, Text } from "@nextui-org/react";
import { MdOutlineDragIndicator } from "react-icons/md";

import Badge from "../../../components/Badge";

function DraggableLabel({ field, index, onMove }) {
  const ref = useRef(null);
  const [{ handlerId }, drop] = useDrop({
    accept: "label",
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      const hoverClientLeft = clientOffset.x - hoverBoundingRect.left;
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }
      // dragging left
      if (dragIndex < hoverIndex && hoverClientLeft < hoverMiddleX) {
        return;
      }
      // dragging right
      if (dragIndex > hoverIndex && hoverClientLeft > hoverMiddleX) {
        return;
      }

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex; // eslint-disable-line
    },
  });

  const [{ isDragging }, drag] = useDrag({ // eslint-disable-line
    type: "label",
    item: () => {
      return { id: field.id, index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  useLayoutEffect(() => {
    drag(drop(ref));
    return () => {
      drag(null);
      drop(null);
    };
  }, [drag, drop, ref]);

  return (
    <div ref={ref} style={{ display: "inline-block" }} data-handler-id={handlerId}>
      <Badge
        type="secondary"
        style={{ ...styles.fieldLabels }}
      >
        <MdOutlineDragIndicator size={20} />
        <Spacer x={0.2} />
        <Text size={14} title={field.Header.replace("?", ".")}>{`${field.Header.replace("?", ".")}  `}</Text>
      </Badge>
    </div>
  );
}

const styles = {
  fieldLabels: {
    cursor: "move",
    maxWidth: 150,
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
};

DraggableLabel.propTypes = {
  field: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  onMove: PropTypes.func.isRequired,
};

export default DraggableLabel;
