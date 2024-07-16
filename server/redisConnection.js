const getRedisOptions = () => {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.CB_REDIS_HOST) {
      console.error("CB_REDIS_HOST is not set. The charts are not going to update automatically."); // eslint-disable-line no-console
    }
    return {
      host: process.env.CB_REDIS_HOST,
      port: process.env.CB_REDIS_PORT,
      password: process.env.CB_REDIS_PASSWORD,
      db: process.env.CB_REDIS_DB,
      tls: process.env.CB_REDIS_CA ? { ca: process.env.CB_REDIS_CA } : undefined,
    };
  } else {
    if (!process.env.CB_REDIS_HOST_DEV) {
      console.error("CB_REDIS_HOST_DEV is not set. The charts are not going to update automatically."); // eslint-disable-line no-console
    }
    return {
      host: process.env.CB_REDIS_HOST_DEV,
      port: process.env.CB_REDIS_PORT_DEV,
      password: process.env.CB_REDIS_PASSWORD_DEV,
      db: process.env.CB_REDIS_DB_DEV,
      tls: process.env.CB_REDIS_CA_DEV ? { ca: process.env.CB_REDIS_CA_DEV } : undefined,
    };
  }
};

const getQueueOptions = () => {
  return {
    connection: getRedisOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "fixed",
        delay: 5000
      },
      removeOnComplete: true,
      removeOnFail: true,
    },
    settings: {
      stalledInterval: 30000,
      maxStalledCount: 3,
    }
  };
};

module.exports = {
  getRedisOptions,
  getQueueOptions,
};
