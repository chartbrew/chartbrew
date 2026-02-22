const nodemailer = require("nodemailer");
const ejs = require("ejs");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

// setup nodemailer
// In tests we don't want to connect to a real SMTP server.
// jsonTransport stores the email payload in-memory and resolves immediately.
const transportConfig = process.env.NODE_ENV === "test"
  ? { jsonTransport: true }
  : settings.mailSettings;

const nodemail = nodemailer.createTransport(transportConfig);

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
    subject: "Chartbrew - Reset your password",
    text: `
      Reset your Chartbrew password

      You can reset your password by clicking the link below:

      ${data.resetUrl}

      Cheers,
      ChartBrew
    `,
    html: `
      <h3>Reset your Chartbrew password 🔑</h3>

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

  ejs.renderFile(`${__dirname}/emailTemplates/alert.ejs`, {
    chartName: data.chartName,
    thresholdText: data.thresholdText,
    alerts: data.alerts,
    dashboardUrl: data.dashboardUrl,
    snapshotUrl: data.snapshotUrl,
  }, (err, str) => {
    if (err) {
      console.log(err); // eslint-disable-line no-console
    }
    message.html = str;

    return nodemail.sendMail(message);
  });
};

module.exports.emailUpdate = (data) => {
  const message = {
    from: settings.adminMail,
    to: data.email,
    subject: "Chartbrew - new email confirmation",
  };

  ejs.renderFile(`${__dirname}/emailTemplates/emailUpdate.ejs`, {
    updateUrl: data.updateUrl,
  }, (err, str) => {
    message.html = str;

    return nodemail.sendMail(message);
  });
};

module.exports.sendDashboardSnapshot = (data) => {
  const message = {
    from: settings.adminMail,
    to: data.recipients,
    subject: `Chartbrew - ${data.projectName} snapshot`,
    attachments: data.attachments || [],
  };

  return new Promise((resolve, reject) => {
    ejs.renderFile(`${__dirname}/emailTemplates/snapshot.ejs`, {
      projectName: data.projectName,
      dashboardUrl: data.dashboardUrl,
      snapshotUrl: data.snapshotUrl,
    }, (err, str) => {
      if (err) {
        return reject(err);
      }

      message.html = str;
      return nodemail.sendMail(message)
        .then((result) => resolve(result))
        .catch((sendErr) => reject(sendErr));
    });
  });
};
