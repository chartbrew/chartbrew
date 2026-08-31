import React from "react";
import PropTypes from "prop-types";
import { Button, ProgressCircle } from "@heroui/react";

import AiDisabledState from "./AiDisabledState";

function AiAccessNotice({
  availability,
  canManagePlatform,
  canManageTeam,
  error,
  isLoading,
  isRequested,
  onNavigate,
  onRetry,
}) {
  if (!isRequested || availability?.enabled === true) return null;

  if (isLoading || (!availability && !error)) {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-3 rounded-2xl border border-divider bg-content2/50 p-4 text-sm text-muted"
        role="status"
      >
        <ProgressCircle aria-label="Checking Chartbrew AI availability" size="sm" />
        Checking whether Chartbrew AI is available…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-divider bg-content2/50 p-4"
        role="alert"
      >
        <div className="flex flex-col gap-1">
          <div className="text-sm font-medium text-foreground">Chartbrew AI access could not be checked</div>
          <div className="text-sm text-muted">Check your connection and try again.</div>
        </div>
        <Button onPress={onRetry} size="sm" variant="secondary">Try again</Button>
      </div>
    );
  }

  return (
    <AiDisabledState
      availability={availability}
      canManagePlatform={canManagePlatform}
      canManageTeam={canManageTeam}
      onNavigate={onNavigate}
    />
  );
}

AiAccessNotice.propTypes = {
  availability: PropTypes.shape({
    disabledBy: PropTypes.oneOf(["platform", "team"]),
    enabled: PropTypes.bool,
  }),
  canManagePlatform: PropTypes.bool,
  canManageTeam: PropTypes.bool,
  error: PropTypes.instanceOf(Error),
  isLoading: PropTypes.bool,
  isRequested: PropTypes.bool.isRequired,
  onNavigate: PropTypes.func,
  onRetry: PropTypes.func.isRequired,
};

AiAccessNotice.defaultProps = {
  availability: null,
  canManagePlatform: false,
  canManageTeam: false,
  error: null,
  isLoading: false,
  onNavigate: undefined,
};

export default AiAccessNotice;
