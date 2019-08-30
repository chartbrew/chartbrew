const nodemailer = require("nodemailer");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

// setup nodemailer
const nodemail = nodemailer.createTransport(settings.mailSettings);

module.exports.sendInvite = (invite, admin, teamName) => {
  const inviteUrl = `${settings.client}/invite?team_id=${invite.team_id}&token=${invite.token}`;

  const message = {
    from: settings.adminMail,
    to: invite.email,
    subject: "ChartBrew - Join the team",
    text: `
      Hi there,

      You have been invited to join ${teamName}. Please click the link below to register your account.

      ${inviteUrl}

      Cheers,
      ChartBrew
    `,
    html: `
      <h3>Hi there 👋</h3>

      <p>You have been invited to join ${teamName}. Please click the link below to register your account.</p>

      <p>${inviteUrl}</p>

      Cheers,
      ChartBrew
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
