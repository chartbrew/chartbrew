const AccessControl = require("accesscontrol");

const grantList = [
  // V3 Access Control List

  //
  // --------------------
  //    TEAM OWNER
  // --------------------
  //
  // resource: team
  {
    role: "teamOwner", resource: "team", action: "create:own", attributes: "*",
  },
  {
    role: "teamOwner", resource: "team", action: "read:own", attributes: "*",
  },
  {
    role: "teamOwner", resource: "team", action: "update:own", attributes: "*",
  },
  {
    role: "teamOwner", resource: "team", action: "delete:own", attributes: "*",
  },
  // resource: project ---> Team Perspective
  {
    role: "teamOwner", resource: "project", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "project", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "project", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "project", action: "delete:any", attributes: "*",
  },
  // resource: connection ---> Team Perspective
  {
    role: "teamOwner", resource: "connection", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "connection", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "connection", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "connection", action: "delete:any", attributes: "*",
  },
  // resource: teamRole ---> Team Perspective
  {
    role: "teamOwner", resource: "teamRole", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "teamRole", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "teamRole", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "teamRole", action: "delete:any", attributes: "*",
  },
  // resource: teamInvite ---> Team Perspective
  {
    role: "teamOwner", resource: "teamInvite", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "teamInvite", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "teamInvite", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "teamInvite", action: "delete:any", attributes: "*",
  },
  // resource: projectRole  ---> Team Perspective
  {
    role: "teamOwner", resource: "projectRole", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "projectRole", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "projectRole", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "projectRole", action: "delete:any", attributes: "*",
  },
  // resource: chart
  {
    role: "teamOwner", resource: "chart", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "chart", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "chart", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "chart", action: "delete:any", attributes: "*",
  },
  // resource: savedQuery ---> Team Perspective
  {
    role: "teamOwner", resource: "savedQuery", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "savedQuery", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "savedQuery", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "savedQuery", action: "delete:any", attributes: "*",
  },
  // resource: dataset ---> Team Perspective
  {
    role: "teamOwner", resource: "dataset", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "dataset", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "dataset", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "dataset", action: "delete:any", attributes: "*",
  },
  // resource: request ---> Team Perspective
  {
    role: "teamOwner", resource: "dataRequest", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "dataRequest", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "dataRequest", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "dataRequest", action: "delete:any", attributes: "*",
  },
  // resource: apiKey ---> Team Perspective
  {
    role: "teamOwner", resource: "apiKey", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "apiKey", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "apiKey", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "apiKey", action: "delete:any", attributes: "*",
  },
  // resource: integration ---> Team Perspective
  {
    role: "teamOwner", resource: "integration", action: "create:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "integration", action: "read:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "integration", action: "update:any", attributes: "*",
  },
  {
    role: "teamOwner", resource: "integration", action: "delete:any", attributes: "*",
  },
  //
  // --------------------
  //    TEAM ADMIN
  // --------------------
  //
  {
    role: "teamAdmin", resource: "team", action: "read:own", attributes: "*",
  },
  // resource: project ---> Team Perspective
  {
    role: "teamAdmin", resource: "project", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "project", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "project", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "project", action: "delete:any", attributes: "*",
  },
  // resource: connection ---> Team Perspective
  {
    role: "teamAdmin", resource: "connection", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "connection", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "connection", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "connection", action: "delete:any", attributes: "*",
  },
  // resource: teamRole ---> Team Perspective
  {
    role: "teamAdmin", resource: "teamRole", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "teamRole", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "teamRole", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "teamRole", action: "delete:any", attributes: "*",
  },
  // resource: teamInvite ---> Team Perspective
  {
    role: "teamAdmin", resource: "teamInvite", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "teamInvite", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "teamInvite", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "teamInvite", action: "delete:any", attributes: "*",
  },
  // resource: projectRole  ---> Team Perspective
  {
    role: "teamAdmin", resource: "projectRole", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "projectRole", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "projectRole", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "projectRole", action: "delete:any", attributes: "*",
  },
  // resource: chart
  {
    role: "teamAdmin", resource: "chart", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "chart", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "chart", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "chart", action: "delete:any", attributes: "*",
  },
  // resource: savedQuery ---> Team Perspective
  {
    role: "teamAdmin", resource: "savedQuery", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "savedQuery", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "savedQuery", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "savedQuery", action: "delete:any", attributes: "*",
  },
  // resource: dataset ---> Team Perspective
  {
    role: "teamAdmin", resource: "dataset", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "dataset", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "dataset", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "dataset", action: "delete:any", attributes: "*",
  },
  // resource: request ---> Team Perspective
  {
    role: "teamAdmin", resource: "dataRequest", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "dataRequest", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "dataRequest", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "dataRequest", action: "delete:any", attributes: "*",
  },
  // resource: apiKey ---> Team Perspective
  {
    role: "teamAdmin", resource: "apiKey", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "apiKey", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "apiKey", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "apiKey", action: "delete:any", attributes: "*",
  },
  // resource: integration ---> Team Perspective
  {
    role: "teamAdmin", resource: "integration", action: "create:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "integration", action: "read:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "integration", action: "update:any", attributes: "*",
  },
  {
    role: "teamAdmin", resource: "integration", action: "delete:any", attributes: "*",
  },

  //
  // --------------------
  //    PROJECT ADMIN
  // --------------------
  //
  {
    role: "projectAdmin", resource: "team", action: "read:own", attributes: ["id", "name"],
  },
  // resource: project ---> Team Perspective
  {
    role: "projectAdmin", resource: "project", action: "read:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "project", action: "update:own", attributes: "*",
  },
  // resource: connection ---> Team Perspective
  {
    role: "projectAdmin", resource: "connection", action: "read:own", attributes: ["id", "name", "type", "subType", "createdAt", "updatedAt"],
  },
  // resource: teamRole ---> Team Perspective
  {
    role: "projectAdmin", resource: "teamRole", action: "read:own", attributes: "*",
  },
  // resource: teamInvite ---> Team Perspective
  //
  // resource: projectRole  ---> Team Perspective
  //
  // resource: chart
  {
    role: "projectAdmin", resource: "chart", action: "create:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "chart", action: "read:any", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "chart", action: "update:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "chart", action: "delete:own", attributes: "*",
  },
  // resource: savedQuery ---> Team Perspective
  //
  // resource: dataset ---> Team Perspective
  {
    role: "projectAdmin", resource: "dataset", action: "create:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "dataset", action: "read:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "dataset", action: "update:own", attributes: "*",
  },
  // resource: request ---> Team Perspective
  {
    role: "projectAdmin", resource: "dataRequest", action: "create:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "dataRequest", action: "read:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "dataRequest", action: "update:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "dataRequest", action: "delete:own", attributes: "*",
  },
  // resource: apiKey ---> Team Perspective
  //
  // resource: integration ---> Team Perspective
  {
    role: "projectAdmin", resource: "integration", action: "create:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "integration", action: "read:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "integration", action: "update:own", attributes: "*",
  },
  {
    role: "projectAdmin", resource: "integration", action: "delete:own", attributes: "*",
  },
  //
  // --------------------
  //    PROJECT EDITOR
  // --------------------
  //
  {
    role: "projectEditor", resource: "team", action: "read:own", attributes: ["id", "name"],
  },
  // resource: project ---> Team Perspective
  {
    role: "projectEditor", resource: "project", action: "read:own", attributes: "*",
  },
  {
    role: "projectEditor", resource: "project", action: "update:own", attributes: "*",
  },
  // resource: connection ---> Team Perspective
  {
    role: "projectEditor", resource: "connection", action: "read:own", attributes: ["id", "name", "type", "subType", "createdAt", "updatedAt"],
  },
  // resource: teamRole ---> Team Perspective
  {
    role: "projectEditor", resource: "teamRole", action: "read:own", attributes: "*",
  },
  // resource: teamInvite ---> Team Perspective
  //
  // resource: projectRole  ---> Team Perspective
  //
  // resource: chart
  {
    role: "projectEditor", resource: "chart", action: "create:own", attributes: "*",
  },
  {
    role: "projectEditor", resource: "chart", action: "read:any", attributes: "*",
  },
  {
    role: "projectEditor", resource: "chart", action: "update:own", attributes: "*",
  },
  {
    role: "projectEditor", resource: "chart", action: "delete:own", attributes: "*",
  },
  // resource: savedQuery ---> Team Perspective
  //
  // resource: dataset ---> Team Perspective
  {
    role: "projectEditor", resource: "dataset", action: "create:own", attributes: "*",
  },
  {
    role: "projectEditor", resource: "dataset", action: "read:own", attributes: "*",
  },
  {
    role: "projectEditor", resource: "dataset", action: "update:own", attributes: "*",
  },
  // resource: request ---> Team Perspective
  {
    role: "projectEditor", resource: "dataRequest", action: "read:own", attributes: "*",
  },
  // resource: apiKey ---> Team Perspective
  //
  // resource: integration ---> Team Perspective
  {
    role: "projectEditor", resource: "integration", action: "create:own", attributes: "*",
  },
  {
    role: "projectEditor", resource: "integration", action: "read:own", attributes: "*",
  },
  {
    role: "projectEditor", resource: "integration", action: "update:own", attributes: "*",
  },
  {
    role: "projectEditor", resource: "integration", action: "delete:own", attributes: "*",
  },
  //
  // --------------------
  //    PROJECT VIEWER
  // --------------------
  //
  {
    role: "projectViewer", resource: "team", action: "read:own", attributes: ["id", "name"],
  },
  // resource: project ---> Team Perspective
  {
    role: "projectViewer", resource: "project", action: "read:own", attributes: "*",
  },
  // resource: connection ---> Team Perspective
  //
  // resource: teamRole ---> Team Perspective
  {
    role: "projectViewer", resource: "teamRole", action: "read:own", attributes: "*",
  },
  // resource: teamInvite ---> Team Perspective
  {
    role: "projectViewer", resource: "teamInvite", action: "read:own", attributes: "*",
  },
  {
    role: "projectViewer", resource: "teamInvite", action: "update:own", attributes: "*",
  },
  // resource: projectRole  ---> Team Perspective
  {
    role: "projectViewer", resource: "projectRole", action: "read:own", attributes: "*",
  },
  // resource: chart
  {
    role: "projectViewer", resource: "chart", action: "read:any", attributes: "*",
  },
  // resource: savedQuery ---> Team Perspective
  //
  // resource: dataset ---> Team Perspective
  {
    role: "projectViewer", resource: "dataset", action: "read:own", attributes: "*",
  },
  // resource: request ---> Team Perspective
  //
  // resource: apiKey ---> Team Perspective
  //
  // resource: integration ---> Team Perspective
  //
  // ----- END OF V3 ACCESS CONTROL LIST -----

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
  // resource: integration ---> Team Perspective
  {
    role: "owner", resource: "integration", action: "create:any", attributes: "*",
  },
  {
    role: "owner", resource: "integration", action: "read:any", attributes: "*",
  },
  {
    role: "owner", resource: "integration", action: "update:any", attributes: "*",
  },
  {
    role: "owner", resource: "integration", action: "delete:any", attributes: "*",
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
  // resource: apiKey ---> Team Perspective
  {
    role: "admin", resource: "integration", action: "create:any", attributes: "*",
  },
  {
    role: "admin", resource: "integration", action: "read:any", attributes: "*",
  },
  {
    role: "admin", resource: "integration", action: "update:any", attributes: "*",
  },
  {
    role: "admin", resource: "integration", action: "delete:any", attributes: "*",
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
  // resource: integration ---> Team Perspective
  {
    role: "editor", resource: "integration", action: "create:any", attributes: "*",
  },
  {
    role: "editor", resource: "integration", action: "read:any", attributes: "*",
  },
  {
    role: "editor", resource: "integration", action: "update:any", attributes: "*",
  },
  {
    role: "editor", resource: "integration", action: "delete:any", attributes: "*",
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
