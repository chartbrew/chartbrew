/* oxlint-disable no-await-in-loop */
const cron = require("node-cron");
const { Queue, Worker } = require("bullmq");
const { Op } = require("sequelize");
const db = require("../models/models");
const { getQueueOptions } = require("../redisConnection");
const { generate, log, settings, snapshotFor } = require("../modules/ai/homeSuggestions/service");
const { getObservationAccess } = require("../modules/observations/access");
const { DAY, isDue } = require("../modules/ai/homeSuggestions/rules");

async function scheduleSuggestions(queue, now = new Date()) {
  let lastId = 0;
  while (true) {
    const states = await db.AiHomeState.findAll({
      where: { id: { [Op.gt]: lastId }, last_active_at: { [Op.gte]: new Date(now - 7 * DAY) } },
      order: [["id", "ASC"]], limit: 100,
    });
    if (!states.length) break;
    for (const state of states) {
      try {
        const access = await getObservationAccess(state.team_id, state.user_id);
        const config = await settings(access);
        if (config.enabled) {
          const snapshot = await snapshotFor(access, state, config, now);
          if (snapshot.resources.length && snapshot.actions.length && isDue(state, snapshot.signature, now, snapshot)) {
            await queue.add("homeSuggestions", { teamId: state.team_id, userId: state.user_id }, {
              deduplication: { id: `home-suggestions-${state.team_id}-${state.user_id}` },
              delay: (state.id % 60) * 60000,
              attempts: 1,
            });
          }
        }
      } catch (error) {
        if (error.statusCode === 403) await state.destroy();
        else log("schedule_failed");
      }
    }
    lastId = states[states.length - 1].id;
  }
  await db.AiHomeState.destroy({ where: { last_active_at: { [Op.lt]: new Date(now - 30 * DAY) } } });
}

function startHomeSuggestions() {
  const queue = new Queue("homeSuggestionsQueue", getQueueOptions());
  queue.on("error", () => log("queue_unavailable"));
  const worker = new Worker(queue.name, async ({ data }) => {
    const status = await generate(data.teamId, data.userId, { manual: data.manual === true });
    log(status);
    return { status };
  }, { connection: queue.opts.connection, concurrency: 2 });
  worker.on("error", () => log("worker_unavailable"));
  worker.on("failed", () => log("generation_failed"));
  const task = cron.schedule("0 0,12 * * *", () => {
    scheduleSuggestions(queue).catch(() => log("schedule_failed"));
  }, { timezone: "UTC" });
  return { queue, worker, task };
}

module.exports = { scheduleSuggestions, startHomeSuggestions };
