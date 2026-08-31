export const AI_DATA_DISCLOSURE = {
  details: "Some Chartbrew AI features use external AI services. To generate a response, Chartbrew may send the member's question and relevant workspace data that the member can access to these services.",
  guidance: "Only enable this if your organization allows this data to be processed by an external AI service.",
  permissions: "Team and project permissions continue to control which data each member can use.",
  title: "How Chartbrew AI processes data",
};

export const TEAM_AI_TOOLTIP = "Chartbrew AI can send a member's question and relevant data they can access to external AI services. Team and project permissions still apply.";

export function getAiEnablementCopy(scope) {
  if (scope === "platform") {
    return {
      message: "Teams can use Chartbrew AI to explore metrics, explain changes, create charts, and prepare actions. Team controls, permissions, and confirmations still apply.",
      title: "Enable Chartbrew AI for this platform?",
    };
  }
  return {
    message: "Team members can explore metrics, explain changes, create charts, and prepare actions. Changes to team data still require permission and confirmation.",
    title: "Enable Chartbrew AI for this team?",
  };
}
