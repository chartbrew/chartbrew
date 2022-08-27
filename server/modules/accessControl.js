const AccessControl = require("accesscontrol");

const grantList = [
  //
  // --------------------
  //    OWNER
  // --------------------
  //
  // resource: team
  {
    role: "owner", resource: "team", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "team", action: "read:own", attributes: "*",
  },
  {
    role: "owner", resource: "team", action: "update:own", attributes: "*",
  },
  {
    role: "owner", resource: "team", action: "delete:own", attributes: "*",
  },
  // resource: project ---> Team Perspective
  {
    role: "owner", resource: "project", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "project", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "project", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "project", action: "delete:any", attributes: "*",
  },
  // resource: connection ---> Team Perspective
  {
    role: "owner", resource: "connection", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "connection", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "connection", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "connection", action: "delete:any", attributes: "*",
  },
  // resource: teamRole ---> Team Perspective
  {
    role: "owner", resource: "teamRole", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "teamRole", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "teamRole", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "teamRole", action: "delete:any", attributes: "*",
  },
  // resource: teamInvite ---> Team Perspective
  {
    role: "owner", resource: "teamInvite", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "teamInvite", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "teamInvite", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "teamInvite", action: "delete:any", attributes: "*",
  },
  // resource: projectRole  ---> Team Perspective
  {
    role: "owner", resource: "projectRole", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "projectRole", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "projectRole", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "projectRole", action: "delete:any", attributes: "*",
  },
  // resource: chart
  {
    role: "owner", resource: "chart", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "chart", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "chart", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "chart", action: "delete:any", attributes: "*",
  },
  // resource: savedQuery ---> Team Perspective
  {
    role: "owner", resource: "savedQuery", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "savedQuery", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "savedQuery", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "savedQuery", action: "delete:any", attributes: "*",
  },
  // resource: dataset ---> Team Perspective
  {
    role: "owner", resource: "dataset", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "dataset", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "dataset", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "dataset", action: "delete:any", attributes: "*",
  },
  // resource: request ---> Team Perspective
  {
    role: "owner", resource: "dataRequest", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "dataRequest", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "dataRequest", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "dataRequest", action: "delete:any", attributes: "*",
  },
  // resource: apiKey ---> Team Perspective
  {
    role: "owner", resource: "apiKey", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "apiKey", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "apiKey", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "apiKey", action: "delete:any", attributes: "*",
  },
  //
  // --------------------
  //    ADMIN
  // --------------------
  //
  // resource: team
  {
    role: "admin", resource: "team", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "team", action: "read:own", attributes: "*",
  },
  {
    role: "admin", resource: "team", action: "update:own", attributes: ["*", "!name"],
  },
  // resource: project ---> Team Perspective
  {
    role: "admin", resource: "project", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "project", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "project", action: "update:any", attributes: "*",
  },
  {
    role: "admin", resource: "project", action: "delete:any", attributes: "*",
  },
  // resource: connection ---> Team Perspective
  {
    role: "admin", resource: "connection", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "connection", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "connection", action: "update:any", attributes: "*",
  },
  {
    role: "admin", resource: "connection", action: "delete:any", attributes: "*",
  },
  // resource: teamRole ---> Team Perspective
  {
    role: "admin", resource: "teamRole", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "teamRole", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "teamRole", action: "update:any", attributes: "*",
  },
  // resource: teamInvite ---> Team Perspective
  {
    role: "admin", resource: "teamInvite", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "teamInvite", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "teamInvite", action: "update:any", attributes: "*",
  },
  {
    role: "admin", resource: "teamInvite", action: "delete:any", attributes: "*",
  },
  // resource: projectRole ---> Team Perspective
  {
    role: "admin", resource: "projectRole", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "projectRole", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "projectRole", action: "update:any", attributes: "*",
  },
  // resource: chart ---> Team Perspective
  {
    role: "admin", resource: "chart", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "chart", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "chart", action: "update:any", attributes: "*",
  },
  {
    role: "admin", resource: "chart", action: "delete:any", attributes: "*",
  },
  // resource: savedQuery ---> Team Perspective
  {
    role: "admin", resource: "savedQuery", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "savedQuery", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "savedQuery", action: "update:any", attributes: "*",
  },
  {
    role: "admin", resource: "savedQuery", action: "delete:any", attributes: "*",
  },
  // resource: dataset ---> Team Perspective
  {
    role: "admin", resource: "dataset", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "dataset", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "dataset", action: "update:any", attributes: "*",
  },
  {
    role: "admin", resource: "dataset", action: "delete:any", attributes: "*",
  },
  // resource: request ---> Team Perspective
  {
    role: "admin", resource: "dataRequest", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "dataRequest", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "dataRequest", action: "update:any", attributes: "*",
  },
  {
    role: "admin", resource: "dataRequest", action: "delete:any", attributes: "*",
  },
  // resource: apiKey ---> Team Perspective
  {
    role: "admin", resource: "apiKey", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "apiKey", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "apiKey", action: "update:any", attributes: "*",
  },
  {
    role: "admin", resource: "apiKey", action: "delete:any", attributes: "*",
  },
  //
  // --------------------
  //    EDITOR
  // --------------------
  //
  // resource: team
  {
    role: "editor", resource: "team", action: "create:any", attributes: "*",
  },
  {
    role: "editor", resource: "team", action: "read:own", attributes: "*",
  },
  // resource: project ---> Team Perspective
  {
    role: "editor", resource: "project", action: "read:any", attributes: "*",
  },
  {
    role: "editor", resource: "project", action: "update:any", attributes: ["backgroundColor", "dashboardTitle", "description", "titleColor"],
  },
  // resource: connection ---> Team Perspective
  {
    role: "editor", resource: "connection", action: "create:any", attributes: "*",
  },
  {
    role: "editor", resource: "connection", action: "read:any", attributes: "*",
  },
  {
    role: "editor", resource: "connection", action: "update:any", attributes: "*",
  },
  {
    role: "editor", resource: "connection", action: "delete:any", attributes: "*",
  },
  // resource: teamRole ---> Team Perspective
  {
    role: "editor", resource: "teamRole", action: "read:any", attributes: "*",
  },
  // resource: teamInvite ---> Team Perspective
  {
    role: "editor", resource: "teamInvite", action: "read:any", attributes: "*",
  },
  // resource: projectRole ---> Team Perspective
  {
    role: "editor", resource: "projectRole", action: "read:any", attributes: "*",
  },
  // resource: chart ---> Team Perspective
  {
    role: "editor", resource: "chart", action: "create:any", attributes: "*",
  },
  {
    role: "editor", resource: "chart", action: "read:any", attributes: "*",
  },
  {
    role: "editor", resource: "chart", action: "update:any", attributes: "*",
  },
  {
    role: "editor", resource: "chart", action: "delete:any", attributes: "*",
  },
  // resource: savedQuery ---> Team Perspective
  {
    role: "editor", resource: "savedQuery", action: "create:any", attributes: "*",
  },
  {
    role: "editor", resource: "savedQuery", action: "read:any", attributes: "*",
  },
  {
    role: "editor", resource: "savedQuery", action: "update:any", attributes: "*",
  },
  {
    role: "editor", resource: "savedQuery", action: "delete:any", attributes: "*",
  },
  // resource: dataset ---> Team Perspective
  {
    role: "editor", resource: "dataset", action: "create:any", attributes: "*",
  },
  {
    role: "editor", resource: "dataset", action: "read:any", attributes: "*",
  },
  {
    role: "editor", resource: "dataset", action: "update:any", attributes: "*",
  },
  {
    role: "editor", resource: "dataset", action: "delete:any", attributes: "*",
  },
  // resource: request ---> Team Perspective
  {
    role: "editor", resource: "dataRequest", action: "create:any", attributes: "*",
  },
  {
    role: "editor", resource: "dataRequest", action: "read:any", attributes: "*",
  },
  {
    role: "editor", resource: "dataRequest", action: "update:any", attributes: "*",
  },
  {
    role: "editor", resource: "dataRequest", action: "delete:any", attributes: "*",
  },
  //
  // --------------------
  //    MEMBER
  // --------------------
  //
  // resource: team
  {
    role: "member", resource: "team", action: "create:any", attributes: "*",
  },
  {
    role: "member", resource: "team", action: "read:own", attributes: "*",
  },
  // resource: project ---> Team Perspective
  {
    role: "member", resource: "project", action: "read:any", attributes: "*",
  },
  // resource: connection ---> Team Perspective
  {
    role: "member", resource: "connection", action: "read:any", attributes: "*",
  },
  // resource: teamRole ---> Team Perspective
  {
    role: "member", resource: "teamRole", action: "read:own", attributes: "*",
  },
  // resource: teamInvite ---> Team Perspective
  {
    role: "member", resource: "teamInvite", action: "read:any", attributes: "*",
  },
  // resource: projectRole ---> Team Perspective
  {
    role: "member", resource: "projectRole", action: "read:any", attributes: "*",
  },
  // resource: chart ---> Team Perspective
  {
    role: "member", resource: "chart", action: "read:any", attributes: "*",
  },
];

module.exports = new AccessControl(grantList);
