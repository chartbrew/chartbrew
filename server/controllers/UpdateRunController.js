const { Op } = require("sequelize");

const db = require("../models/models");

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

class UpdateRunController {
  buildFilters(teamId, filters = {}) {
    const where = {
      teamId,
    };

    if (filters.trace_id) {
      where[Op.or] = [
        { traceId: filters.trace_id },
        { rootTraceId: filters.trace_id },
      ];
    }

    if (filters.project_id) {
      where.projectId = filters.project_id;
    }

    if (filters.chart_id) {
      where.chartId = filters.chart_id;
    }

    if (filters.dataset_id) {
      where.datasetId = filters.dataset_id;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.trigger_type) {
      where.triggerType = filters.trigger_type;
    }

    const from = parseDate(filters.from);
    const to = parseDate(filters.to);
    if (from && to) {
      where.startedAt = {
        [Op.between]: [from, to],
      };
    } else if (from) {
      where.startedAt = {
        [Op.gte]: from,
      };
    } else if (to) {
      where.startedAt = {
        [Op.lte]: to,
      };
    }

    return where;
  }

  async findByTeam(teamId, filters = {}) {
    const where = this.buildFilters(teamId, filters);
    return db.UpdateRun.findAll({
      where,
      order: [["startedAt", "DESC"]],
    });
  }

  async findByIdAndTeam(id, teamId) {
    const where = {
      id,
      teamId,
    };

    const run = await db.UpdateRun.findOne({
      where,
      include: [{
        model: db.UpdateRunEvent,
        as: "events",
        required: false,
      }],
      order: [[{ model: db.UpdateRunEvent, as: "events" }, "sequence", "ASC"]],
    });

    if (!run) {
      return null;
    }

    const childRuns = await db.UpdateRun.findAll({
      where: { parentRunId: run.id },
      include: [{
        model: db.UpdateRunEvent,
        as: "events",
        required: false,
      }],
      order: [["startedAt", "ASC"], [{ model: db.UpdateRunEvent, as: "events" }, "sequence", "ASC"]],
    });

    const plainRun = run.toJSON();
    plainRun.childRuns = childRuns.map((childRun) => childRun.toJSON());
    return plainRun;
  }
}

module.exports = UpdateRunController;
