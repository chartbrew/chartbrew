const nodemailer = require("nodemailer");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

// setup nodemailer
const nodemail = nodemailer.createTransport(settings.mailSettings);

module.exports.sendInvite = (invite, admin, teamName) => {
  const inviteUrl = `${settings.client}/invite?team_id=${invite.team_id}&token=${invite.token}`;

  const message = {
    from: settings.adminMail,
    to: invite.email,
    subject: "Chartbrew - Join the team",
    text: `
      Hi there,

      You have been invited to join ${teamName}. Please click the link below to register your account.

      ${inviteUrl}

      - Chartbrew
    `,
    html: `
      <h3>Hi there 👋</h3>

      <p>You have been invited to join ${teamName}. Please click the link below to register your account.</p>

      <p>${inviteUrl}</p>

      - Chartbrew
    `,
  };

  return nodemail.sendMail(message);
};

module.exports.passwordReset = (data) => {
  const message = {
    from: settings.adminMail,
    to: data.email,
    subject: "ChartBrew - Reset your password",
    text: `
      Reset your ChartBrew password

      You can reset your password by clicking the link below:

      ${data.resetUrl}

      Cheers,
      ChartBrew
    `,
    html: `
      <h3>Reset your ChartBrew password 🔑</h3>

      <p>You can reset your password by clicking the link below:</p>

      <p>${data.resetUrl}</p>

      Cheers,
      ChartBrew
    `,
  };

  return nodemail.sendMail(message);
};

module.exports.sendChartAlert = (data) => {
  const message = {
    from: settings.adminMail,
    bcc: data.recipients,
    subject: `Chartbrew - ${data.chartName} alert`,
  };

  /** TEXT */
  message.text = `Your "${data.chartName}" chart has a new alert`;
  message.text += "\n";
  message.text += `${data.thresholdText}`;
  message.text += "\n";
  for (let i = 0; i < data.alerts.length; i++) {
    message.text += `${data.alerts[i]}`;
    message.text += "\n";
  }
  message.text += `Check your dashboard here: ${data.dashboardUrl}`;
  message.text += "\n";
  message.text += "- Chartbrew";
  // ------------------------------

  /** HTML */
  message.html = `<h3>Your "${data.chartName}" chart has a new alert</h3>`;
  message.html += "<br />";
  message.html += `<p><strong>${data.thresholdText}</strong></p>`;
  message.html += "<ul>";
  for (let i = 0; i < data.alerts.length; i++) {
    message.html += `<li>${data.alerts[i]}</li>`;
  }
  message.html += "</ul>";
  message.html += "<br />";
  message.html += `<p><strong><a href="${data.dashboardUrl}">Check your dashboard here</a></strong></p>`;
  message.html += "<br />";
  message.html += "<p> - Chartbrew </p>";
  // ------------------------------

  return nodemail.sendMail(message);
};
