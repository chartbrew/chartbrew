const getRedisEnvValue = (name, overridePrefix = null) => {
  if (overridePrefix) {
    const overrideValue = process.env[`${overridePrefix}_${name}`];
    if (overrideValue !== undefined && overrideValue !== "") {
      return overrideValue;
    }
  }

  return process.env[`CB_REDIS_${name}`];
};

const hasRedisOverrides = (overridePrefix) => {
  if (!overridePrefix) return false;

  return [
    "HOST",
    "PORT",
    "PASSWORD",
    "DB",
    "CA",
    "CLUSTER_NODES",
  ].some((name) => {
    const value = process.env[`${overridePrefix}_${name}`];
    return value !== undefined && value !== "";
  });
};

const getRedisOptions = (overridePrefix = null) => {
  const host = getRedisEnvValue("HOST", overridePrefix);
  if (!host) {
    const envKey = `${overridePrefix || "CB_REDIS"}_HOST`;
    console.error(`${envKey} is not set. The charts are not going to update automatically.`); // oxlint-disable-line no-console
  }

  return {
    host,
    port: getRedisEnvValue("PORT", overridePrefix),
    password: getRedisEnvValue("PASSWORD", overridePrefix),
    db: getRedisEnvValue("DB", overridePrefix),
    tls: getRedisEnvValue("CA", overridePrefix)
      ? { ca: getRedisEnvValue("CA", overridePrefix) }
      : undefined,
  };
};

const parsePositiveInt = (value, fallback) => {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
};

const getRedisClusterOptions = (overridePrefix = null) => {
  const clusterNodes = getRedisEnvValue("CLUSTER_NODES", overridePrefix);

  if (clusterNodes) {
    const nodes = clusterNodes.split(",").map((node) => {
      const [host, port] = node.trim().split(":");
      return { host, port: parseInt(port, 10) || 6379 };
    });

    const clusterOptions = {
      enableReadyCheck: false,
      redisOptions: {
        password: getRedisEnvValue("PASSWORD", overridePrefix),
      }
    };

    // Add TLS configuration if provided
    const tlsCa = getRedisEnvValue("CA", overridePrefix);

    if (tlsCa) {
      clusterOptions.redisOptions.tls = { ca: tlsCa };
    }

    return { cluster: { nodes, options: clusterOptions } };
  }

  return null;
};

const getQueueOptions = () => {
  // Check if cluster configuration is available
  const clusterConfig = getRedisClusterOptions();
  const removeOnCompleteAge = parsePositiveInt(
    process.env.CB_QUEUE_KEEP_COMPLETE_AGE_SECONDS,
    86400
  );
  const removeOnCompleteCount = parsePositiveInt(
    process.env.CB_QUEUE_KEEP_COMPLETE_COUNT,
    1000
  );
  const removeOnFailAge = parsePositiveInt(
    process.env.CB_QUEUE_KEEP_FAIL_AGE_SECONDS,
    604800
  );
  const removeOnFailCount = parsePositiveInt(process.env.CB_QUEUE_KEEP_FAIL_COUNT, 5000);

  return {
    connection: clusterConfig || getRedisOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "fixed",
        delay: 5000
      },
      removeOnComplete: {
        age: removeOnCompleteAge,
        count: removeOnCompleteCount,
      },
      removeOnFail: {
        age: removeOnFailAge,
        count: removeOnFailCount,
      },
    },
    settings: {
      stalledInterval: 30000,
      maxStalledCount: 3,
    }
  };
};

module.exports = {
  getRedisOptions,
  getRedisClusterOptions,
  getQueueOptions,
  hasRedisOverrides,
};
