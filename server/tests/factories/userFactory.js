import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";

const TEST_PASSWORD_HASH = bcrypt.hashSync("password123", 10);

export const userFactory = {
  build: (overrides = {}) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: TEST_PASSWORD_HASH,
      active: true,
      admin: false,
      tutorials: JSON.stringify({}),
      lastLogin: null,
      icon: null,
      passwordResetToken: null,
      oneaccountId: null,
      ...overrides
    };
  },

  buildMany: (count, overrides = {}) => {
    return Array.from({ length: count }, () => userFactory.build(overrides));
  },

  // Helper for creating admin users
  buildAdmin: (overrides = {}) => {
    return userFactory.build({
      admin: true,
      name: "Admin User",
      email: "admin@test.com",
      ...overrides
    });
  },

  // Helper for creating inactive users
  buildInactive: (overrides = {}) => {
    return userFactory.build({
      active: false,
      ...overrides
    });
  }
};
