import { faker } from "@faker-js/faker";

export const connectionFactory = {
  build: (overrides = {}) => {
    return {
      name: `${faker.company.name()} Connection`,
      type: "api",
      subType: null,
      active: true,
      host: faker.internet.url(),
      dbName: null,
      port: null,
      username: null,
      password: null,
      srv: false,
      options: JSON.stringify([]),
      connectionString: null,
      authentication: JSON.stringify({}),
      firebaseServiceAccount: null,
      ssl: false,
      sslMode: "require",
      sslCa: null,
      sslCert: null,
      sslKey: null,
      schema: null,
      useSsh: false,
      sshHost: null,
      sshPort: null,
      sshUsername: null,
      sshPassword: null,
      sshPrivateKey: null,
      sshPassphrase: null,
      sshJumpHost: null,
      sshJumpPort: null,
      oauth_id: null,
      project_ids: JSON.stringify([]),
      team_id: null, // Should be set when creating
      ...overrides
    };
  },

  buildMany: (count, overrides = {}) => {
    return Array.from({ length: count }, () => connectionFactory.build(overrides));
  },

  // Helper for creating MySQL connections
  buildMySQL: (overrides = {}) => {
    return connectionFactory.build({
      type: "mysql",
      host: "localhost",
      port: "3306",
      dbName: "test_db",
      username: "testuser",
      password: "testpass",
      ...overrides
    });
  },

  // Helper for creating PostgreSQL connections
  buildPostgreSQL: (overrides = {}) => {
    return connectionFactory.build({
      type: "postgres",
      host: "localhost",
      port: "5432",
      dbName: "test_db",
      username: "testuser",
      password: "testpass",
      ...overrides
    });
  },

  // Helper for creating API connections with auth
  buildApiWithAuth: (overrides = {}) => {
    return connectionFactory.build({
      type: "api",
      host: faker.internet.url(),
      authentication: JSON.stringify({
        type: "bearer_token",
        token: faker.string.alphanumeric(32)
      }),
      ...overrides
    });
  },

  // Helper for creating MongoDB connections
  buildMongoDB: (overrides = {}) => {
    return connectionFactory.build({
      type: "mongodb",
      connectionString: `mongodb://${faker.internet.domainName()}:27017/test_db`,
      ...overrides
    });
  }
};
