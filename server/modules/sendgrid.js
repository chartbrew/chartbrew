const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");
const base64 = require("base-64");
const utf8 = require("utf8");
const request = require("request-promise");

module.exports.sendInvite = (invite, admin, teamName) => {
  const inviteUrl = `${settings.client}/invite?team_id=${invite.team_id}&token=${invite.token}`;

  const inviteMsg = {
    "from": { "email": "info@depomo.com" },
    "subject": "Join the team",
    "personalizations": [{
      "to": [{ email: invite.email }],
      "dynamic_template_data": {
        "first_name": admin,
        "team_name": teamName,
        "invite_url": inviteUrl
      }
    }],
    "template_id": "d-a1a0a72588324b67a6678f71719ee312"
  };

  const options = {
    method: "POST",
    url: `${settings.sendgrid.host}/mail/send`,
    body: JSON.stringify(inviteMsg),
    headers: {
      authorization: `Bearer ${settings.sendgrid.key}`,
      "content-type": "application/json"
    }
  };

  return request(options);
};

module.exports.addUserToMailList = (recipientId, listId) => {
  const options = {
    method: "POST",
    url: `${settings.sendgrid.host}/contactdb/lists/${listId}/recipients/${recipientId}`,
    headers: {
      authorization: `Bearer ${settings.sendgrid.key}`,
      "content-type": "application/json"
    }
  };

  return request(options);
};

module.exports.createRecipient = (user) => {
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
    url: `${settings.sendgrid.host}/marketing/contacts`,
    body: JSON.stringify(recipientMsg),
    headers: {
      authorization: `Bearer ${settings.sendgrid.key}`,
      "content-type": "application/json"
    }
  };
  return request(recipientOptions);
};

module.exports.getRecipientId = (user) => {
  const bytes = utf8.encode(user.email);
  const encoded = base64.encode(bytes);
  return encoded;
};

module.exports.deleteUser = (recipientId) => {
  const options = {
    method: "DELETE",
    url: `${settings.sendgrid.host}/contactdb/recipients/${recipientId}`,
    headers: {
      authorization: `Bearer ${settings.sendgrid.key}`,
      "content-type": "application/json"
    }
  };
  return request(options);
};

module.exports.goodbyeEmail = (user) => {
  const feedbackUrl = `${settings.client}/feedback`;

  const message = {
    "from": { "email": "info@depomo.com" },
    "subject": "We are sorry to see you leave",
    "personalizations": [{
      "to": [{ email: user.email }],
      "dynamic_template_data": {
        "first_name": user.name,
        "feedback_url": feedbackUrl
      }
    }],
    "template_id": "d-b9749448b58d49a4a85485b74c5fc137"
  };

  const options = {
    method: "POST",
    url: `${settings.sendgrid.host}/mail/send`,
    body: JSON.stringify(message),
    headers: {
      authorization: `Bearer ${settings.sendgrid.key}`,
      "content-type": "application/json"
    }
  };
  return request(options);
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
    url: `${settings.sendgrid.host}/mail/send`,
    body: JSON.stringify(message),
    headers: {
      authorization: `Bearer ${settings.sendgrid.key}`,
      "content-type": "application/json"
    }
  };
  return request(options);
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
    url: `${settings.sendgrid.host}/mail/send`,
    body: JSON.stringify(message),
    headers: {
      authorization: `Bearer ${settings.sendgrid.key}`,
      "content-type": "application/json"
    }
  };
  return request(options);
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
    url: `${settings.sendgrid.host}/mail/send`,
    body: JSON.stringify(message),
    headers: {
      authorization: `Bearer ${settings.sendgrid.key}`,
      "content-type": "application/json"
    }
  };
  return request(options);
};
