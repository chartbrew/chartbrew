export function getAiDisabledGuidance(availability, permissions = {}) {
  if (availability?.disabledBy === "team") {
    if (permissions.canManageTeam) {
      return {
        actionLabel: "Open team settings",
        message: "Turn it on in Team settings to use Chartbrew AI for this team.",
        settingsPath: "/settings/team?enableAi=team",
        title: "Chartbrew AI is off for this team",
      };
    }
    return {
      actionLabel: null,
      message: "Contact a team owner or admin to enable Chartbrew AI for this team.",
      settingsPath: null,
      title: "Chartbrew AI is off for this team",
    };
  }

  if (permissions.canManagePlatform) {
    return {
      actionLabel: "Open platform settings",
      message: "Turn it on in Platform settings to use Chartbrew AI.",
      settingsPath: "/settings/platform?enableAi=platform",
      title: "Chartbrew AI is off for this platform",
    };
  }
  return {
    actionLabel: null,
    message: "Contact a platform administrator to enable Chartbrew AI.",
    settingsPath: null,
    title: "Chartbrew AI is off for this platform",
  };
}

export function canSubmitAiMessage(availability) {
  return availability?.enabled === true;
}
