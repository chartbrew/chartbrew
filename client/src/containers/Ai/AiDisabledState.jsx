import React from "react";
import PropTypes from "prop-types";
import { Alert, Button } from "@heroui/react";
import { useNavigate } from "react-router";

import { getAiDisabledGuidance } from "./aiAvailability";

function AiDisabledState({ availability, canManagePlatform, canManageTeam, onNavigate }) {
  const navigate = useNavigate();
  const guidance = getAiDisabledGuidance(availability, {
    canManagePlatform,
    canManageTeam,
  });

  const openSettings = () => {
    if (!guidance.settingsPath) return;
    onNavigate?.();
    navigate(guidance.settingsPath);
  };

  return (
    <Alert
      aria-live="polite"
      className="border border-divider shadow-none"
      role="status"
      status="warning"
    >
      <Alert.Indicator />
      <Alert.Content className="gap-3">
        <div className="flex flex-col gap-1">
          <Alert.Title>
            {guidance.title}
          </Alert.Title>
          <Alert.Description className="max-w-lg leading-6">
            {guidance.message}
          </Alert.Description>
        </div>
        {guidance.actionLabel ? (
          <Button onPress={openSettings} size="sm" variant="primary">
            {guidance.actionLabel}
          </Button>
        ) : null}
      </Alert.Content>
    </Alert>
  );
}

AiDisabledState.propTypes = {
  availability: PropTypes.shape({
    disabledBy: PropTypes.oneOf(["platform", "team"]),
    enabled: PropTypes.bool,
  }).isRequired,
  canManagePlatform: PropTypes.bool,
  canManageTeam: PropTypes.bool,
  onNavigate: PropTypes.func,
};

AiDisabledState.defaultProps = {
  canManagePlatform: false,
  canManageTeam: false,
  onNavigate: undefined,
};

export default AiDisabledState;
