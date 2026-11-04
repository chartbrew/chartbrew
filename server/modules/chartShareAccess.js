const { verifyProjectPassword } = require("./projectPassword");

module.exports = async (chart, project, password) => {
  if (!project?.public || !chart.onReport || chart.draft || (!chart.public && !chart.shareable)) {
    throw new Error("401");
  }
  if (project.passwordProtected && !await verifyProjectPassword(password, project.password)) {
    const error = new Error("Enter the correct password");
    error.code = "PASSWORD_REQUIRED";
    throw error;
  }
};
