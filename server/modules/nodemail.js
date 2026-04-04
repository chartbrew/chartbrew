const path = require("path");
const React = require("react");
const nodemailer = require("nodemailer");
const { render } = require("@react-email/render");
const createJiti = require("jiti");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");
const jiti = createJiti(__filename, { jsx: true, interopDefault: true });
const emailTemplatePaths = {
  forgotPassword: path.join(__dirname, "../email-templates/emails/forgot-password.tsx"),
  emailUpdate: path.join(__dirname, "../email-templates/emails/email-update.tsx"),
  chartAlert: path.join(__dirname, "../email-templates/emails/chart-alert.tsx"),
  dashboardSnapshot: path.join(__dirname, "../email-templates/emails/dashboard-snapshot.tsx"),
};

// setup nodemailer
// In tests we don't want to connect to a real SMTP server.
// jsonTransport stores the email payload in-memory and resolves immediately.
const transportConfig = process.env.NODE_ENV === "test"
  ? { jsonTransport: true }
  : settings.mailSettings;

const nodemail = nodemailer.createTransport(transportConfig);
const emailComponentCache = {};

function getEmailComponent(templateName) {
  if (!emailComponentCache[templateName]) {
    const templateModule = jiti(emailTemplatePaths[templateName]);
    emailComponentCache[templateName] = templateModule.default || templateModule;
  }

  return emailComponentCache[templateName];
}

async function renderEmailTemplate(templateName, props) {
  const EmailComponent = getEmailComponent(templateName);

  return render(React.createElement(EmailComponent, {
    ...props,
    supportEmail: settings.adminMail,
  }));
}

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

module.exports.passwordReset = async (data) => {
  const emailHtml = await renderEmailTemplate("forgotPassword", {
    resetUrl: data.resetUrl,
  });

  const message = {
    from: settings.adminMail,
    to: data.email,
    subject: "Chartbrew - Reset your password",
    text: `
      Reset your Chartbrew password

      You can reset your password by clicking the link below:

      ${data.resetUrl}

      Cheers,
      ChartBrew
    `,
    html: emailHtml,
  };

  return nodemail.sendMail(message);
};

module.exports.sendChartAlert = async (data) => {
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
  const emailHtml = await renderEmailTemplate("chartAlert", {
    chartName: data.chartName,
    thresholdText: data.thresholdText,
    alerts: data.alerts,
    dashboardUrl: data.dashboardUrl,
    snapshotUrl: data.snapshotUrl,
  });

  message.html = emailHtml;

  return nodemail.sendMail(message);
};

module.exports.emailUpdate = async (data) => {
  const emailHtml = await renderEmailTemplate("emailUpdate", {
    updateUrl: data.updateUrl,
  });

  const message = {
    from: settings.adminMail,
    to: data.email,
    subject: "Chartbrew - new email confirmation",
    text: `
      Confirm your new email address

      Open the link below to confirm your new email address. This link expires in 3 hours.

      ${data.updateUrl}

      - Chartbrew
    `,
    html: emailHtml,
  };

  return nodemail.sendMail(message);
};

module.exports.sendDashboardSnapshot = (data) => {
  const message = {
    from: settings.adminMail,
    to: data.recipients,
    subject: `Chartbrew - ${data.projectName} snapshot`,
    attachments: data.attachments || [],
  };

  return new Promise((resolve, reject) => {
    renderEmailTemplate("dashboardSnapshot", {
      projectName: data.projectName,
      dashboardUrl: data.dashboardUrl,
      snapshotUrl: data.snapshotUrl,
    })
      .then((emailHtml) => {
        message.text = `
          New snapshot of ${data.projectName}

          A new dashboard snapshot has been generated.

          View live dashboard: ${data.dashboardUrl}
          ${data.snapshotUrl ? `Snapshot preview: ${data.snapshotUrl}` : ""}

          - Chartbrew
        `;
        message.html = emailHtml;
        return nodemail.sendMail(message);
      })
      .then((result) => resolve(result))
      .catch((error) => reject(error));
  });
};
