const { PREVIEW_TOOLS } = require("./planValidator");
const {
  buildFailedWorkerOutput,
  validateWorkerOutput,
} = require("./workerContract");

function isPreviewTask(task) {
  return task.allowedTools.some((tool) => PREVIEW_TOOLS.has(tool));
}

function getDependencyResults(task, resultsByTaskId) {
  return task.dependsOn.map((taskId) => resultsByTaskId.get(taskId));
}

async function runOneTask(task, options, resultsByTaskId) {
  try {
    const rawOutput = await options.runWorker({
      dependencyResults: getDependencyResults(task, resultsByTaskId),
      task,
    });
    return options.validateWorkerResult
      ? options.validateWorkerResult(rawOutput, task)
      : validateWorkerOutput(rawOutput, {
        allowedFactIds: new Set(),
        factRegistry: new Map(),
        previewPrepared: false,
        task,
      });
  } catch (error) {
    return buildFailedWorkerOutput(task.taskId, error.code || "worker_failed");
  }
}

async function runReadBatch(tasks, options, resultsByTaskId) {
  const maximumParallelWorkers = Math.min(
    Math.max(Number(options.maximumParallelWorkers) || 1, 1),
    2
  );
  for (let index = 0; index < tasks.length; index += maximumParallelWorkers) {
    const batch = tasks.slice(index, index + maximumParallelWorkers);
    // oxlint-disable-next-line no-await-in-loop
    const outputs = await Promise.all(batch.map((task) => (
      runOneTask(task, options, resultsByTaskId)
    )));
    batch.forEach((task, taskIndex) => {
      resultsByTaskId.set(task.taskId, outputs[taskIndex]);
    });
  }
}

async function dispatchPlan(plan, options = {}) {
  if (typeof options.runWorker !== "function") {
    throw new Error("A server worker runner is required");
  }
  const pending = new Map(plan.tasks.map((task) => [task.taskId, task]));
  const resultsByTaskId = new Map();
  while (pending.size > 0) {
    const ready = [...pending.values()].filter((task) => (
      task.dependsOn.every((taskId) => resultsByTaskId.has(taskId))
    ));
    if (ready.length === 0) {
      throw new Error("The validated plan cannot make progress");
    }
    const readTasks = ready.filter((task) => !isPreviewTask(task));
    // oxlint-disable-next-line no-await-in-loop
    await runReadBatch(readTasks, options, resultsByTaskId);
    const previewTasks = ready.filter(isPreviewTask);
    for (const task of previewTasks) {
      // Preview creation is always sequential.
      // oxlint-disable-next-line no-await-in-loop
      const output = await runOneTask(task, options, resultsByTaskId);
      resultsByTaskId.set(task.taskId, output);
    }
    ready.forEach((task) => pending.delete(task.taskId));
  }
  return plan.tasks.map((task) => resultsByTaskId.get(task.taskId));
}

module.exports = {
  dispatchPlan,
  getDependencyResults,
  isPreviewTask,
  runOneTask,
};
