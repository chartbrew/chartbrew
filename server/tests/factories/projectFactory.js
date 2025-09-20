import { faker } from "@faker-js/faker";

export const projectFactory = {
  build: (overrides = {}) => {
    const name = faker.company.name();
    return {
      name,
      brewName: faker.helpers.slugify(name).toLowerCase(),
      dashboardTitle: `${name} Dashboard`,
      description: faker.lorem.paragraph(),
      backgroundColor: "#103751",
      titleColor: "white",
      headerCode: null,
      footerCode: null,
      logo: null,
      logoLink: null,
      public: false,
      passwordProtected: false,
      password: null,
      timezone: faker.location.timeZone(),
      ghost: false,
      updateSchedule: JSON.stringify({}),
      snapshotSchedule: JSON.stringify({}),
      lastUpdatedAt: null,
      lastSnapshotSentAt: null,
      currentSnapshot: null,
      team_id: null, // Should be set when creating
      ...overrides
    };
  },

  buildMany: (count, overrides = {}) => {
    return Array.from({ length: count }, () => projectFactory.build(overrides));
  },

  // Helper for creating public projects
  buildPublic: (overrides = {}) => {
    return projectFactory.build({
      public: true,
      ...overrides
    });
  },

  // Helper for creating password-protected projects
  buildPasswordProtected: (overrides = {}) => {
    return projectFactory.build({
      passwordProtected: true,
      password: faker.internet.password(),
      ...overrides
    });
  }
};
