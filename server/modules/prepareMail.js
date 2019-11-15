const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");
const base64 = require("base-64");
const utf8 = require("utf8");

module.exports.sendInvite = (app, invite, admin, teamName) => {
  const inviteUrl = `${app.settings.client}/invite?team_id=${invite.team_id}&token=${invite.token}`;

  const inviteMsg = {
    "from": { "email": "info@depomo.com" },
    "subject": "Join the team",
    "personalizations": [{
      "to": [{ email: invite.email }],
      "substitutions": {
        "%first_name%": admin,
        "%team_name%": teamName,
        "%insertLink%": inviteUrl
      }
    }],
    "template_id": "2b9740d1-aacf-46fd-9312-d11a0973def0"
  };

  const options = {
    method: "POST",
    url: `${app.settings.sendgridHost}/mail/send`,
    body: JSON.stringify(inviteMsg),
    headers: {
      authorization: `Bearer ${app.settings.sendgridKey}`,
      "content-type": "application/json"
    }
  };
  return options;
};

module.exports.addUserToMailList = (app, recipientId, listId) => {
  const options = {
    method: "POST",
    url: `${app.settings.sendgridHost}/contactdb/lists/${listId}/recipients/${recipientId}`,
    headers: {
      authorization: `Bearer ${app.settings.sendgridKey}`,
      "content-type": "application/json"
    }
  };
  return options;
};

module.exports.createRecipient = (app, user) => {
  const recipientMsg = {
    "listIds": [settings.sendgridInterestedList],
    "contacts": [
      {
        "email": user.email,
        "first_name": user.name || "",
        "last_name": user.surname || ""
      }
    ]
  };

  const recipientOptions = {
    method: "PUT",
    url: `${app.settings.sendgridHost}/marketing/contacts`,
    body: JSON.stringify(recipientMsg),
    headers: {
      authorization: `Bearer ${app.settings.sendgridKey}`,
      "content-type": "application/json"
    }
  };
  return recipientOptions;
};

module.exports.getRecipientId = (app, user) => {
  const bytes = utf8.encode(user.email);
  const encoded = base64.encode(bytes);
  return encoded;
};

module.exports.deleteUser = (app, recipientId) => {
  const options = {
    method: "DELETE",
    url: `${app.settings.sendgridHost}/contactdb/recipients/${recipientId}`,
    headers: {
      authorization: `Bearer ${app.settings.sendgridKey}`,
      "content-type": "application/json"
    }
  };
  return options;
};

module.exports.goodbyeEmail = (app, user) => {
  const feedbackUrl = `${app.settings.client}/feedback`;

  const message = {
    "from": { "email": "info@depomo.com" },
    "subject": "We are sorry to see you leave",
    "personalizations": [{
      "to": [{ email: user.email }],
      "substitutions": {
        "%first_name%": user.name,
        "%feedback_url%": feedbackUrl
      }
    }],
    "template_id": "03b780dc-f2ca-4a25-b190-e1ec4a527cd1"
  };

  const options = {
    method: "POST",
    url: `${app.settings.sendgridHost}/mail/send`,
    body: JSON.stringify(message),
    headers: {
      authorization: `Bearer ${app.settings.sendgridKey}`,
      "content-type": "application/json"
    }
  };
  return options;
};

module.exports.updateSubscription = (data) => {
  const message = {
    "from": { "email": "info@depomo.com" },
    "subject": "Your new subscription",
    "personalizations": [{
      "to": [{ email: data.email }],
      "dynamic_template_data": {
        "plan_name": data.plan,
        "button_url": `${settings.client}/user`,
      }
    }],
    "template_id": "d-03afb5238183429a938da78bbcc2ce43"
  };

  const options = {
    method: "POST",
    url: `${settings.sendgridHost}/mail/send`,
    body: JSON.stringify(message),
    headers: {
      authorization: `Bearer ${settings.sendgridKey}`,
      "content-type": "application/json"
    }
  };
  return options;
};

module.exports.endSubscription = (data) => {
  const message = {
    "from": { "email": "info@depomo.com" },
    "subject": "Your subscription was ended",
    "personalizations": [{
      "to": [{ email: data.email }],
      "dynamic_template_data": {
        "feedback_url": `${settings.client}/feedback`,
      }
    }],
    "template_id": "d-db93054c7e3644a298afb40f4b7f3db8"
  };

  const options = {
    method: "POST",
    url: `${settings.sendgridHost}/mail/send`,
    body: JSON.stringify(message),
    headers: {
      authorization: `Bearer ${settings.sendgridKey}`,
      "content-type": "application/json"
    }
  };
  return options;
};

module.exports.passwordReset = (data) => {
  const message = {
    "from": { "email": "info@depomo.com" },
    "subject": "ChartBrew - Password Reset",
    "personalizations": [{
      "to": [{ email: data.email }],
      "dynamic_template_data": {
        "reset_url": data.resetUrl,
      }
    }],
    "template_id": "d-63ae5fe316b2406b8b7dd3f009ecf43d",
  };

  const options = {
    method: "POST",
    url: `${settings.sendgridHost}/mail/send`,
    body: JSON.stringify(message),
    headers: {
      authorization: `Bearer ${settings.sendgridKey}`,
      "content-type": "application/json"
    }
  };
  return options;
};
