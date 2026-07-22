import React from "react";
import PropTypes from "prop-types";
import { Chip } from "@heroui/react";

function DashboardFilterLabel({ children, icon: Icon }) {
  return (
    <Chip variant="soft" size="sm" className="shrink-0 rounded-sm text-xs">
      {Icon && <Icon size={14} />}
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

DashboardFilterLabel.propTypes = {
  children: PropTypes.node.isRequired,
  icon: PropTypes.elementType,
};

export default DashboardFilterLabel;
