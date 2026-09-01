import React from "react";
import PropTypes from "prop-types";
import { Button } from "@heroui/react";
import { useNavigate } from "react-router";

import { getAiDisabledGuidance } from "./aiAvailability";
import { LuPowerOff } from "react-icons/lu";

function AiAvailabilityStatus({ availability, canManagePlatform, canManageTeam, onNavigate }) {
  const navigate = useNavigate();

  if (availability?.enabled !== false) return null;

  const guidance = getAiDisabledGuidance(availability, {
    canManagePlatform,
    canManageTeam,
  });

  if (!guidance.settingsPath) {
    return (
      <span className="whitespace-nowrap px-1 text-xs font-medium text-muted">
        AI is off · Ask an admin
      </span>
    );
  }

  const openSettings = () => {
    onNavigate?.();
    navigate(guidance.settingsPath);
  };

  return (
    <Button
      className="h-7 min-h-7 whitespace-nowrap rounded-full px-2.5 text-xs text-muted"
      onPress={openSettings}
      size="sm"
      type="button"
      variant="tertiary"
    >
      <LuPowerOff size={12} />
      AI is disabled
    </Button>
  );
}

AiAvailabilityStatus.propTypes = {
  availability: PropTypes.shape({
    disabledBy: PropTypes.oneOf(["platform", "team"]),
    enabled: PropTypes.bool,
  }),
  canManagePlatform: PropTypes.bool,
  canManageTeam: PropTypes.bool,
  onNavigate: PropTypes.func,
};

AiAvailabilityStatus.defaultProps = {
  availability: null,
  canManagePlatform: false,
  canManageTeam: false,
  onNavigate: undefined,
};

export default AiAvailabilityStatus;
