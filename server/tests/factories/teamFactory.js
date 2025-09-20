import { faker } from "@faker-js/faker";

export const teamFactory = {
  build: (overrides = {}) => {
    return {
      name: faker.company.name(),
      showBranding: true,
      allowReportRefresh: false,
      allowReportExport: false,
      ...overrides
    };
  },

  buildMany: (count, overrides = {}) => {
    return Array.from({ length: count }, () => teamFactory.build(overrides));
  },

  // Helper for creating teams with advanced permissions
  buildWithPermissions: (overrides = {}) => {
    return teamFactory.build({
      allowReportRefresh: true,
      allowReportExport: true,
      ...overrides
    });
  }
};
