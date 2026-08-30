const crypto = require("crypto");
const Redis = require("ioredis");

const db = require("../models/models");
const { normalizeValue } = require("./chartRuntimeFilters");

const RUNTIME_REDIS_ENV_PREFIX = "CB_RUNTIME_REDIS";
const RUNTIME_CACHE_DEBUG_ENABLED = parseBoolean(process.env.CB_RUNTIME_CACHE_DEBUG);

function parsePositiveInt(value, fallback) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function parseBoolean(value) {
  return /^(1|true|yes|on)$/i.test(`${value || ""}`);
}

function getRuntimeRedisEnvValue(name) {
  const overrideValue = process.env[`${RUNTIME_REDIS_ENV_PREFIX}_${name}`];
  if (overrideValue !== undefined && overrideValue !== "") {
    return overrideValue;
  }

  return process.env[`CB_REDIS_${name}`];
}

function hasRuntimeRedisOverrides() {
  return [
    "HOST",
    "PORT",
    "PASSWORD",
    "DB",
    "CA",
    "CLUSTER_NODES",
  ].some((name) => {
    const value = process.env[`${RUNTIME_REDIS_ENV_PREFIX}_${name}`];
    return value !== undefined && value !== "";
  });
}

function getRuntimeRedisOptions() {
  const host = getRuntimeRedisEnvValue("HOST");
  if (!host) {
    const envKey = `${RUNTIME_REDIS_ENV_PREFIX}_HOST or CB_REDIS_HOST`;
    console.error(`${envKey} is not set. Runtime chart caching will fall back to memory.`); // oxlint-disable-line no-console
  }

  return {
    host,
    port: getRuntimeRedisEnvValue("PORT"),
    password: getRuntimeRedisEnvValue("PASSWORD"),
    db: getRuntimeRedisEnvValue("DB"),
    tls: getRuntimeRedisEnvValue("CA")
      ? { ca: getRuntimeRedisEnvValue("CA") }
      : undefined,
  };
}

function getRuntimeRedisClusterOptions() {
  const clusterNodes = getRuntimeRedisEnvValue("CLUSTER_NODES");

  if (!clusterNodes) {
    return null;
  }

  const nodes = clusterNodes.split(",").map((node) => {
    const [host, port] = node.trim().split(":");
    return { host, port: parseInt(port, 10) || 6379 };
  });

  const clusterOptions = {
    enableReadyCheck: false,
    redisOptions: {
      password: getRuntimeRedisEnvValue("PASSWORD"),
    }
  };

  const tlsCa = getRuntimeRedisEnvValue("CA");
  if (tlsCa) {
    clusterOptions.redisOptions.tls = { ca: tlsCa };
  }

  return { cluster: { nodes, options: clusterOptions } };
}

const DEFAULT_RUNTIME_CACHE_CONFIG = Object.freeze({
  cacheSchemaVersion: "1",
  chartCacheTtlMs: 5 * 60 * 1000,
  chartCacheStaleTtlMs: 15 * 60 * 1000,
  sourceCacheTtlMs: 2 * 60 * 1000,
  sourceCacheStaleTtlMs: 10 * 60 * 1000,
  variantLimitPerChart: 25,
});

const RUNTIME_CACHE_CONFIG = Object.freeze({
  cacheSchemaVersion: process.env.CB_RUNTIME_CACHE_SCHEMA_VERSION
    || DEFAULT_RUNTIME_CACHE_CONFIG.cacheSchemaVersion,
  chartCacheTtlMs: parsePositiveInt(
    process.env.CB_RUNTIME_CHART_CACHE_TTL_MS,
    DEFAULT_RUNTIME_CACHE_CONFIG.chartCacheTtlMs,
  ),
  chartCacheStaleTtlMs: parsePositiveInt(
    process.env.CB_RUNTIME_CHART_CACHE_STALE_TTL_MS,
    DEFAULT_RUNTIME_CACHE_CONFIG.chartCacheStaleTtlMs,
  ),
  sourceCacheTtlMs: parsePositiveInt(
    process.env.CB_RUNTIME_SOURCE_CACHE_TTL_MS,
    DEFAULT_RUNTIME_CACHE_CONFIG.sourceCacheTtlMs,
  ),
  sourceCacheStaleTtlMs: parsePositiveInt(
    process.env.CB_RUNTIME_SOURCE_CACHE_STALE_TTL_MS,
    DEFAULT_RUNTIME_CACHE_CONFIG.sourceCacheStaleTtlMs,
  ),
  variantLimitPerChart: parsePositiveInt(
    process.env.CB_RUNTIME_CACHE_VARIANT_LIMIT,
    DEFAULT_RUNTIME_CACHE_CONFIG.variantLimitPerChart,
  ),
});

class InMemoryRuntimeStore {
  constructor() {
    this.values = new Map();
    this.sortedSets = new Map();
    this.hashes = new Map();
    this.hashExpiries = new Map();
  }

  clearExpiredHash(key) {
    const expiresAt = this.hashExpiries.get(key);
    if (expiresAt && expiresAt <= Date.now()) {
      this.hashes.delete(key);
      this.hashExpiries.delete(key);
      return true;
    }
    return false;
  }

  async get(key) {
    const entry = this.values.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key, value, ttlMs = 0) {
    this.values.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
    });
    return "OK";
  }

  async del(key) {
    this.values.delete(key);
    this.sortedSets.delete(key);
    this.hashes.delete(key);
    this.hashExpiries.delete(key);
    return 1;
  }

  async consume(key) {
    const entry = this.values.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    this.values.delete(key);
    return entry.value;
  }

  async hset(key, field, value) {
    this.clearExpiredHash(key);
    const hash = this.hashes.get(key) || new Map();
    if (value === undefined) {
      hash.delete(field);
      if (hash.size === 0) {
        this.hashes.delete(key);
      } else {
        this.hashes.set(key, hash);
      }
      return 1;
    }

    hash.set(field, value);
    this.hashes.set(key, hash);
    return 1;
  }

  async hdel(key, ...fields) {
    if (this.clearExpiredHash(key)) return 0;
    const hash = this.hashes.get(key);
    if (!hash) return 0;

    let removedCount = 0;
    fields.forEach((field) => {
      if (hash.delete(field)) {
        removedCount += 1;
      }
    });

    if (hash.size === 0) {
      this.hashes.delete(key);
      this.hashExpiries.delete(key);
    }

    return removedCount;
  }

  async hget(key, field) {
    if (this.clearExpiredHash(key)) return null;
    const hash = this.hashes.get(key);
    return hash ? (hash.get(field) ?? null) : null;
  }

  async hgetall(key) {
    if (this.clearExpiredHash(key)) return {};
    const hash = this.hashes.get(key);
    if (!hash) return {};

    return Array.from(hash.entries()).reduce((acc, [field, value]) => {
      acc[field] = value;
      return acc;
    }, {});
  }

  async pexpire(key, ttlMs) {
    if (!this.hashes.has(key)) return 0;
    this.hashExpiries.set(key, Date.now() + Math.max(Number(ttlMs) || 0, 0));
    return 1;
  }

  async zscore(key, member) {
    const sortedSet = this.sortedSets.get(key);
    return sortedSet ? (sortedSet.get(member) ?? null) : null;
  }

  async zincrby(key, increment, member) {
    const sortedSet = this.sortedSets.get(key) || new Map();
    const nextScore = (sortedSet.get(member) || 0) + Number(increment);
    sortedSet.set(member, nextScore);
    this.sortedSets.set(key, sortedSet);
    return nextScore;
  }

  async zrevrange(key, start, end) {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return [];

    const members = Array.from(sortedSet.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([member]) => member);

    const normalizedEnd = end < 0 ? members.length : end + 1;
    return members.slice(start, normalizedEnd);
  }

  async zrem(key, ...members) {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return 0;

    let removedCount = 0;
    members.forEach((member) => {
      if (sortedSet.delete(member)) {
        removedCount += 1;
      }
    });

    if (sortedSet.size === 0) {
      this.sortedSets.delete(key);
    }

    return removedCount;
  }

  async zcard(key) {
    const sortedSet = this.sortedSets.get(key);
    return sortedSet ? sortedSet.size : 0;
  }

  async zremrangebyrank(key, start, end) {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return 0;

    const members = Array.from(sortedSet.entries())
      .sort((left, right) => left[1] - right[1])
      .map(([member]) => member);
    const normalizedEnd = end < 0 ? members.length : end + 1;
    const membersToDelete = members.slice(start, normalizedEnd);
    return this.zrem(key, ...membersToDelete);
  }
}

function createMemoryStore(envPrefix = "CB_REDIS") {
  const memoryStore = new InMemoryRuntimeStore();
  return {
    backend: "memory",
    envPrefix,
    close: async () => {},
    clear: () => {
      memoryStore.values.clear();
      memoryStore.sortedSets.clear();
      memoryStore.hashes.clear();
      memoryStore.hashExpiries.clear();
    },
    get: (...args) => memoryStore.get(...args),
    set: (...args) => memoryStore.set(...args),
    del: (...args) => memoryStore.del(...args),
    consume: (...args) => memoryStore.consume(...args),
    hset: (...args) => memoryStore.hset(...args),
    hget: (...args) => memoryStore.hget(...args),
    hgetall: (...args) => memoryStore.hgetall(...args),
    hdel: (...args) => memoryStore.hdel(...args),
    pexpire: (...args) => memoryStore.pexpire(...args),
    zscore: (...args) => memoryStore.zscore(...args),
    zincrby: (...args) => memoryStore.zincrby(...args),
    zrevrange: (...args) => memoryStore.zrevrange(...args),
    zrem: (...args) => memoryStore.zrem(...args),
    zcard: (...args) => memoryStore.zcard(...args),
    zremrangebyrank: (...args) => memoryStore.zremrangebyrank(...args),
  };
}

function createRedisStore() {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return createMemoryStore("TEST_MEMORY");
  }
  try {
    const runtimeRedisOverridesEnabled = hasRuntimeRedisOverrides();
    const clusterConfig = getRuntimeRedisClusterOptions();
    const resolvedEnvPrefix = runtimeRedisOverridesEnabled ? RUNTIME_REDIS_ENV_PREFIX : "CB_REDIS";
    let redisClient;
    const attachClient = () => {
      redisClient.on("error", (error) => {
        console.error("[runtime-cache] Redis client error", error); // oxlint-disable-line no-console
      });

      return {
        backend: clusterConfig?.cluster?.nodes?.length > 0 ? "redis-cluster" : "redis",
        envPrefix: resolvedEnvPrefix,
        close: async () => redisClient.disconnect(),
        get: (...args) => redisClient.get(...args),
        set: (key, value, ttlMs = 0) => {
          if (ttlMs > 0) {
            return redisClient.set(key, value, "PX", ttlMs);
          }
          return redisClient.set(key, value);
        },
        del: (...args) => redisClient.del(...args),
        consume: (key) => redisClient.eval(
          "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
          1,
          key
        ),
        hset: (...args) => redisClient.hset(...args),
        hget: (...args) => redisClient.hget(...args),
        hgetall: (...args) => redisClient.hgetall(...args),
        hdel: (...args) => redisClient.hdel(...args),
        pexpire: (...args) => redisClient.pexpire(...args),
        zscore: (...args) => redisClient.zscore(...args),
        zincrby: (...args) => redisClient.zincrby(...args),
        zrevrange: (...args) => redisClient.zrevrange(...args),
        zrem: (...args) => redisClient.zrem(...args),
        zcard: (...args) => redisClient.zcard(...args),
        zremrangebyrank: (...args) => redisClient.zremrangebyrank(...args),
      };
    };

    if (clusterConfig?.cluster?.nodes?.length > 0) {
      redisClient = new Redis.Cluster(clusterConfig.cluster.nodes, clusterConfig.cluster.options);
      console.log(`[runtime-cache] using Redis cluster via ${resolvedEnvPrefix} settings`); // oxlint-disable-line no-console
      return attachClient();
    } else {
      const redisOptions = getRuntimeRedisOptions();
      if (!redisOptions?.host) {
        console.warn("[runtime-cache] Redis host missing, using in-memory runtime cache store"); // oxlint-disable-line no-console
        return createMemoryStore(resolvedEnvPrefix);
      }

      redisClient = new Redis(redisOptions);
      console.log(`[runtime-cache] using Redis via ${resolvedEnvPrefix} settings`); // oxlint-disable-line no-console
    }
    return attachClient();
  } catch (error) {
    console.error("[runtime-cache] Failed to initialize Redis store, falling back to in-memory cache", error); // oxlint-disable-line no-console
    return createMemoryStore();
  }
}

class RuntimeCacheService {
  constructor() {
    this.store = createRedisStore();
    this.inFlight = new Map();
    this.debugEnabled = RUNTIME_CACHE_DEBUG_ENABLED;
    this.debugLog("initialized", {
      backend: this.store.backend || "unknown",
      envPrefix: this.store.envPrefix || "CB_REDIS",
      config: RUNTIME_CACHE_CONFIG,
    });
  }

  debugLog(event, payload = {}) {
    if (!this.debugEnabled) return;
    console.log(`[runtime-cache][${event}]`, payload); // oxlint-disable-line no-console
  }

  backendInfo() {
    return {
      backend: this.store.backend || "unknown",
      envPrefix: this.store.envPrefix || "CB_REDIS",
    };
  }

  hash(value) {
    return crypto
      .createHash("sha256")
      .update(typeof value === "string" ? value : JSON.stringify(normalizeValue(value)))
      .digest("hex");
  }

  preparedCacheKey({ chartId, chartVersion, variantHash, viewerScope = "shared" }) {
    return `prepared-cache:v${RUNTIME_CACHE_CONFIG.cacheSchemaVersion}:${chartId}:${chartVersion}:${viewerScope}:${variantHash}`;
  }

  sourceCacheKey({ datasetId, sourceVersion, variantHash, viewerScope = "shared" }) {
    return `source-cache:v${RUNTIME_CACHE_CONFIG.cacheSchemaVersion}:${datasetId}:${sourceVersion}:${viewerScope}:${variantHash}`;
  }

  usageKey(chartId) {
    return `chart-cache:v${RUNTIME_CACHE_CONFIG.cacheSchemaVersion}:usage:${chartId}`;
  }

  usageMetaKey(chartId) {
    return `chart-cache:v${RUNTIME_CACHE_CONFIG.cacheSchemaVersion}:usage-meta:${chartId}`;
  }

  registryKey(scope, id) {
    return `runtime-cache:v${RUNTIME_CACHE_CONFIG.cacheSchemaVersion}:registry:${scope}:${id}`;
  }

  aiSessionKey({ sessionId, teamId, userId }) {
    return `ai-session:v1:${teamId}:${userId}:${sessionId}`;
  }

  pendingAiActionKey({ actionId, sessionId, teamId, userId }) {
    return `ai-pending-action:v1:${teamId}:${userId}:${this.hash(sessionId)}:${actionId}`;
  }

  pendingAiActionResultKey({ actionId, sessionId, teamId, userId }) {
    return `ai-pending-action-result:v1:${teamId}:${userId}:${this.hash(sessionId)}:${actionId}`;
  }

  pendingAiActionRegistryKey({ teamId }) {
    return `ai-pending-action-registry:v1:${teamId}`;
  }

  pendingAiActionRegistryField({ actionId, sessionId, userId }) {
    return `${userId}:${this.hash(sessionId)}:${actionId}`;
  }

  async getAiSession(params = {}) {
    const rawValue = await this.store.get(this.aiSessionKey(params));
    if (!rawValue) return null;

    try {
      return typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    } catch (error) {
      await this.store.del(this.aiSessionKey(params));
      return null;
    }
  }

  async setAiSession(params = {}) {
    const ttlHours = Math.min(
      Math.max(parsePositiveInt(process.env.CB_AI_EPHEMERAL_SESSION_TTL_HOURS, 24), 1),
      24,
    );
    return this.store.set(
      this.aiSessionKey(params),
      JSON.stringify(params.payload),
      ttlHours * 60 * 60 * 1000,
    );
  }

  async deleteAiSession(params = {}) {
    return this.store.del(this.aiSessionKey(params));
  }

  async getPendingAiAction(params = {}) {
    const rawValue = await this.store.get(this.pendingAiActionKey(params));
    if (!rawValue) return null;
    try {
      return typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    } catch (error) {
      await this.store.del(this.pendingAiActionKey(params));
      return null;
    }
  }

  async setPendingAiAction(params = {}) {
    const ttlSeconds = Math.min(
      Math.max(parsePositiveInt(process.env.CB_WORKSPACE_CONTEXT_PREVIEW_TTL_SECONDS, 600), 60),
      600
    );
    const actionKey = this.pendingAiActionKey(params);
    const registryKey = this.pendingAiActionRegistryKey(params);
    const registryField = this.pendingAiActionRegistryField(params);
    await this.store.set(
      actionKey,
      JSON.stringify(params.payload),
      ttlSeconds * 1000
    );
    try {
      await this.store.hset(registryKey, registryField, JSON.stringify({
        actionId: params.actionId,
        actionType: params.payload?.actionType || null,
        expiresAt: params.payload?.expiresAt || null,
        projectId: params.payload?.scope?.projectId || null,
        resourceId: params.payload?.scope?.resourceId || null,
        sessionId: params.sessionId,
        userId: params.userId,
      }));
      await this.store.pexpire(registryKey, 24 * 60 * 60 * 1000);
    } catch (error) {
      await this.store.del(actionKey);
      throw error;
    }
    return "OK";
  }

  async consumePendingAiAction(params = {}) {
    const rawValue = await this.store.consume(this.pendingAiActionKey(params));
    if (!rawValue) return null;
    try {
      return typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    } catch (error) {
      return null;
    }
  }

  async getPendingAiActionResult(params = {}) {
    const rawValue = await this.store.get(this.pendingAiActionResultKey(params));
    if (!rawValue) return null;
    try {
      return typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    } catch (error) {
      return null;
    }
  }

  async setPendingAiActionResult(params = {}) {
    const result = await this.store.set(
      this.pendingAiActionResultKey(params),
      JSON.stringify(params.payload),
      24 * 60 * 60 * 1000
    );
    await this.store.pexpire(
      this.pendingAiActionRegistryKey(params),
      24 * 60 * 60 * 1000
    );
    return result;
  }

  async listPendingAiActions(params = {}) {
    const registryKey = this.pendingAiActionRegistryKey(params);
    const entries = await this.store.hgetall(registryKey);
    const references = Object.entries(entries).map(([field, value]) => {
      try {
        return { field, reference: JSON.parse(value) };
      } catch (_error) {
        return { field, reference: null };
      }
    });
    const candidates = references.filter(({ reference }) => {
      if (!reference) return false;
      if (params.userId && Number(reference.userId) !== Number(params.userId)) return false;
      if (params.sessionId && reference.sessionId !== params.sessionId) return false;
      if (params.projectId
        && Number(reference.projectId) !== Number(params.projectId)) return false;
      if (params.resourceId && `${reference.resourceId}` !== `${params.resourceId}`) return false;
      return true;
    });
    const resolved = await Promise.all(candidates.map(async ({ field, reference }) => {
      const referenceParams = {
        actionId: reference.actionId,
        sessionId: reference.sessionId,
        teamId: params.teamId,
        userId: reference.userId,
      };
      const pendingAction = await this.getPendingAiAction(referenceParams);
      const priorResult = pendingAction
        ? null
        : await this.getPendingAiActionResult(referenceParams);
      return { field, pendingAction, priorResult };
    }));
    const pendingActions = resolved.map(({ pendingAction }) => pendingAction).filter(Boolean);
    const staleFields = [
      ...references.filter(({ reference }) => !reference).map(({ field }) => field),
      ...resolved.filter(({ pendingAction, priorResult }) => !pendingAction && !priorResult)
        .map(({ field }) => field),
    ];
    if (staleFields.length > 0) {
      await this.store.hdel(registryKey, ...staleFields);
    }
    return pendingActions;
  }

  async clearPendingAiActions(params = {}) {
    if (!params.teamId) return 0;
    const registryKey = this.pendingAiActionRegistryKey(params);
    const entries = await this.store.hgetall(registryKey);
    const matches = Object.entries(entries).reduce((result, [field, value]) => {
      try {
        const reference = JSON.parse(value);
        if (params.userId && Number(reference.userId) !== Number(params.userId)) return result;
        if (params.sessionId && reference.sessionId !== params.sessionId) return result;
        if (params.projectId
          && Number(reference.projectId) !== Number(params.projectId)) return result;
        if (params.resourceId
          && `${reference.resourceId}` !== `${params.resourceId}`) return result;
        result.push({ field, reference });
      } catch (error) {
        result.push({ field, reference: null });
      }
      return result;
    }, []);
    await Promise.all(matches.flatMap(({ reference }) => {
      if (!reference) return [];
      const referenceParams = {
        actionId: reference.actionId,
        sessionId: reference.sessionId,
        teamId: params.teamId,
        userId: reference.userId,
      };
      return [
        this.store.del(this.pendingAiActionKey(referenceParams)),
        this.store.del(this.pendingAiActionResultKey(referenceParams)),
      ];
    }));
    if (matches.length > 0) {
      await this.store.hdel(registryKey, ...matches.map(({ field }) => field));
    }
    return matches.length;
  }

  async getPreparedCache(params = {}) {
    return this.getCacheEntry({
      cacheKey: this.preparedCacheKey(params),
      cacheType: "prepared",
    });
  }

  async setPreparedCache(params = {}) {
    return this.setCacheEntry({
      cacheKey: this.preparedCacheKey(params),
      payload: params.payload,
      ttlMs: RUNTIME_CACHE_CONFIG.chartCacheTtlMs,
      staleTtlMs: RUNTIME_CACHE_CONFIG.chartCacheStaleTtlMs,
      registryKey: this.registryKey("chart", params.chartId),
    });
  }

  async getSourceCache(params = {}) {
    return this.getCacheEntry({
      cacheKey: this.sourceCacheKey(params),
      cacheType: "source",
    });
  }

  async setSourceCache(params = {}) {
    return this.setCacheEntry({
      cacheKey: this.sourceCacheKey(params),
      payload: params.payload,
      ttlMs: RUNTIME_CACHE_CONFIG.sourceCacheTtlMs,
      staleTtlMs: RUNTIME_CACHE_CONFIG.sourceCacheStaleTtlMs,
      registryKey: this.registryKey("dataset", params.datasetId),
    });
  }

  async getCacheEntry({ cacheKey, cacheType }) {
    try {
      const rawValue = await this.store.get(cacheKey);
      if (!rawValue) {
        this.debugLog("cache_miss", { cacheType, cacheKey });
        return null;
      }

      const parsedValue = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
      const now = Date.now();
      const isFresh = parsedValue.freshUntil > now;
      const isStale = !isFresh && parsedValue.staleUntil > now;

      if (!isFresh && !isStale) {
        await this.store.del(cacheKey);
        this.debugLog("cache_expired", { cacheType, cacheKey });
        return null;
      }

      this.debugLog("cache_hit", {
        cacheType,
        cacheKey,
        stale: isStale,
        fresh: isFresh,
      });
      return {
        key: cacheKey,
        cacheType,
        payload: parsedValue.payload,
        stale: isStale,
        fresh: isFresh,
        createdAt: parsedValue.createdAt,
        freshUntil: parsedValue.freshUntil,
        staleUntil: parsedValue.staleUntil,
      };
    } catch (error) {
      this.debugLog("cache_read_error", {
        cacheType,
        cacheKey,
        error: error.message,
      });
      return null;
    }
  }

  async setCacheEntry({ cacheKey, payload, ttlMs, staleTtlMs, registryKey }) {
    const createdAt = Date.now();
    const cacheEnvelope = {
      payload,
      createdAt,
      freshUntil: createdAt + ttlMs,
      staleUntil: createdAt + staleTtlMs,
    };

    await this.store.set(cacheKey, JSON.stringify(cacheEnvelope), staleTtlMs);
    await this.store.hset(registryKey, cacheKey, `${cacheEnvelope.staleUntil}`);
    this.debugLog("cache_write", {
      cacheKey,
      registryKey,
      ttlMs,
      staleTtlMs,
    });
    return cacheEnvelope;
  }

  async trackChartVariantUsage({ chartId, variantHash, runtimePayload, weight = 1 }) {
    if (!chartId || !variantHash || !runtimePayload?.hasRuntimeFilters) {
      return;
    }

    const usageKey = this.usageKey(chartId);
    const metaKey = this.usageMetaKey(chartId);
    const normalizedWeight = Number.isFinite(Number(weight)) ? Number(weight) : 1;

    await this.store.zincrby(usageKey, normalizedWeight, variantHash);
    await this.store.hset(metaKey, variantHash, JSON.stringify({
      variantHash,
      payload: runtimePayload,
      lastSeenAt: Date.now(),
    }));
    this.debugLog("variant_tracked", {
      chartId,
      variantHash,
      weight: normalizedWeight,
    });

    const entryCount = await this.store.zcard(usageKey);
    if (entryCount > RUNTIME_CACHE_CONFIG.variantLimitPerChart) {
      const overflowCount = entryCount - RUNTIME_CACHE_CONFIG.variantLimitPerChart;
      await this.store.zremrangebyrank(usageKey, 0, overflowCount - 1);
      const retainedHashes = new Set(
        await this.store.zrevrange(usageKey, 0, RUNTIME_CACHE_CONFIG.variantLimitPerChart - 1)
      );
      const metadata = await this.store.hgetall(metaKey);
      await Promise.all(
        Object.keys(metadata)
          .filter((hashKey) => !retainedHashes.has(hashKey))
          .map((hashKey) => this.store.hdel(metaKey, hashKey))
      );
    }
  }

  async getTopChartVariants(chartId, limit = 5) {
    if (!chartId) return [];

    const variantHashes = await this.store.zrevrange(this.usageKey(chartId), 0, Math.max(0, limit - 1));
    if (!variantHashes || variantHashes.length === 0) {
      return [];
    }

    return Promise.all(variantHashes.map(async (variantHash) => {
      const rawMetadata = await this.store.hget(this.usageMetaKey(chartId), variantHash);
      if (!rawMetadata) return null;

      try {
        return JSON.parse(rawMetadata);
      } catch (_error) {
        return null;
      }
    })).then((variants) => variants.filter(Boolean));
  }

  async buildChartFingerprints(chartId, timezone = "") {
    const chartFingerprint = await db.Chart.findOne({
      where: { id: chartId },
      attributes: [
        "id",
        "project_id",
        "name",
        "type",
        "subType",
        "displayLegend",
        "pointRadius",
        "dataLabels",
        "startDate",
        "endDate",
        "dateVarsFormat",
        "includeZeros",
        "currentEndDate",
        "fixedStartDate",
        "timeInterval",
        "mode",
        "maxValue",
        "minValue",
        "disabledExport",
        "onReport",
        "xLabelTicks",
        "stacked",
        "horizontal",
        "showGrowth",
        "invertGrowth",
        "isLogarithmic",
        "ranges",
        "visualization",
      ],
      include: [{
        model: db.ChartDatasetConfig,
        attributes: [
          "id",
          "dataset_id",
          "xAxis",
          "xAxisOperation",
          "yAxis",
          "yAxisOperation",
          "dateField",
          "dateFormat",
          "conditions",
          "formula",
          "datasetColor",
          "fillColor",
          "fill",
          "multiFill",
          "legend",
          "pointRadius",
          "excludedFields",
          "sort",
          "columnsOrder",
          "order",
          "maxRecords",
          "goal",
          "configuration",
          "updatedAt",
        ],
        include: [{
          model: db.Dataset,
          attributes: [
            "id",
            "fieldsSchema",
            "joinSettings",
            "main_dr_id",
            "xAxis",
            "xAxisOperation",
            "yAxis",
            "yAxisOperation",
            "dateField",
            "dateFormat",
            "legend",
            "conditions",
            "formula",
            "excludedFields",
            "configuration",
            "updatedAt",
          ],
          include: [
            {
              model: db.DataRequest,
              attributes: [
                "id",
                "dataset_id",
                "connection_id",
                "method",
                "route",
                "useGlobalHeaders",
                "query",
                "pagination",
                "items",
                "itemsLimit",
                "offset",
                "paginationField",
                "template",
                "conditions",
                "configuration",
                "transform",
                "updatedAt",
              ],
              include: [
                {
                  model: db.Connection,
                  attributes: ["id", "type", "subType", "updatedAt"],
                  required: false,
                },
              ],
            },
          ],
        }],
      }],
      order: [
        [db.ChartDatasetConfig, "order", "ASC"],
        [db.ChartDatasetConfig, db.Dataset, db.DataRequest, "id", "ASC"],
      ],
    });

    const plainChartFingerprint = chartFingerprint ? chartFingerprint.toJSON() : null;

    if (plainChartFingerprint?.ChartDatasetConfigs?.length > 0) {
      const datasets = plainChartFingerprint.ChartDatasetConfigs
        .map((cdc) => cdc.Dataset)
        .filter(Boolean);
      const datasetIds = datasets.map((dataset) => `${dataset.id}`);
      const dataRequests = datasets.flatMap((dataset) => dataset.DataRequests || []);
      const dataRequestIds = dataRequests.map((dataRequest) => `${dataRequest.id}`);

      const [datasetBindings, dataRequestBindings] = await Promise.all([
        datasetIds.length > 0
          ? db.VariableBinding.findAll({
            where: {
              entity_type: "Dataset",
              entity_id: datasetIds,
            },
            attributes: [
              "id",
              "entity_type",
              "entity_id",
              "name",
              "type",
              "default_value",
              "required",
              "updatedAt",
            ],
            order: [["entity_id", "ASC"], ["name", "ASC"]],
          })
          : Promise.resolve([]),
        dataRequestIds.length > 0
          ? db.VariableBinding.findAll({
            where: {
              entity_type: "DataRequest",
              entity_id: dataRequestIds,
            },
            attributes: [
              "id",
              "entity_type",
              "entity_id",
              "name",
              "type",
              "default_value",
              "required",
              "updatedAt",
            ],
            order: [["entity_id", "ASC"], ["name", "ASC"]],
          })
          : Promise.resolve([]),
      ]);

      const datasetBindingsByEntityId = datasetBindings.reduce((acc, binding) => {
        const entityId = `${binding.entity_id}`;
        if (!acc[entityId]) acc[entityId] = [];
        acc[entityId].push(binding.toJSON());
        return acc;
      }, {});

      const dataRequestBindingsByEntityId = dataRequestBindings.reduce((acc, binding) => {
        const entityId = `${binding.entity_id}`;
        if (!acc[entityId]) acc[entityId] = [];
        acc[entityId].push(binding.toJSON());
        return acc;
      }, {});

      plainChartFingerprint.ChartDatasetConfigs = plainChartFingerprint.ChartDatasetConfigs.map((cdc) => {
        if (!cdc.Dataset) return cdc;

        const datasetEntityId = `${cdc.Dataset.id}`;
        const enrichedDataset = {
          ...cdc.Dataset,
          VariableBindings: datasetBindingsByEntityId[datasetEntityId] || [],
          DataRequests: (cdc.Dataset.DataRequests || []).map((dataRequest) => ({
            ...dataRequest,
            VariableBindings: dataRequestBindingsByEntityId[`${dataRequest.id}`] || [],
          })),
        };

        return {
          ...cdc,
          Dataset: enrichedDataset,
        };
      });
    }

    const sourceInput = plainChartFingerprint?.ChartDatasetConfigs || [];
    const visualizationInput = plainChartFingerprint
      ? { ...plainChartFingerprint, ChartDatasetConfigs: undefined }
      : null;
    const visualization = this.hash({
      timezone,
      chart: visualizationInput,
    });
    const source = this.hash({
      timezone,
      sources: sourceInput,
    });

    return {
      combined: this.hash({ source, visualization }),
      source,
      visualization,
    };
  }

  async buildChartVersion(chartId, timezone = "") {
    const fingerprints = await this.buildChartFingerprints(chartId, timezone);
    return fingerprints.combined;
  }

  buildDatasetVersion(dataset, timezone = "") {
    return this.hash({
      timezone,
      dataset: dataset && typeof dataset.toJSON === "function" ? dataset.toJSON() : dataset,
    });
  }

  runSingleFlight(key, factory) {
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = Promise.resolve()
      .then(factory)
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  triggerBackgroundRefresh(key, factory) {
    if (this.inFlight.has(key)) {
      return;
    }

    this.runSingleFlight(key, factory).catch(() => {
      // Ignore background refresh failures so dashboard responses stay non-blocking.
    });
  }

  async resetForTests() {
    this.inFlight.clear();

    if (typeof this.store.clear === "function") {
      this.store.clear();
    }
  }

  async close() {
    this.inFlight.clear();
    await this.store.close?.();
  }
}

module.exports = new RuntimeCacheService();
module.exports.RuntimeCacheService = RuntimeCacheService;
module.exports.DEFAULT_RUNTIME_CACHE_CONFIG = DEFAULT_RUNTIME_CACHE_CONFIG;
module.exports.RUNTIME_CACHE_CONFIG = RUNTIME_CACHE_CONFIG;
