const { Worker } = require("worker_threads");

const { IMAGE_RENDER_LIMITS } = require("./imageLimits");

function createRenderError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

class RenderWorkerQueue {
  constructor(options = {}) {
    this.active = null;
    this.closed = false;
    this.nextId = 1;
    this.queue = [];
    this.queueWaitMs = options.queueWaitMs || IMAGE_RENDER_LIMITS.queueWaitMs;
    this.renderTimeoutMs = options.renderTimeoutMs || IMAGE_RENDER_LIMITS.renderTimeoutMs;
    this.worker = null;
    this.workerFile = options.workerFile || require.resolve("./renderWorker.js");
  }

  render(document, options = {}) {
    if (this.closed) {
      return Promise.reject(createRenderError("IMAGE_RENDER_CLOSED", "Image renderer is closed"));
    }
    if (options.signal?.aborted) {
      return Promise.reject(createRenderError("IMAGE_RENDER_ABORTED", "Image rendering was cancelled"));
    }
    if (this.queue.length + (this.active ? 1 : 0) >= IMAGE_RENDER_LIMITS.maxQueueLength) {
      return Promise.reject(createRenderError("IMAGE_RENDER_BUSY", "The image render queue is full"));
    }

    return new Promise((resolve, reject) => {
      const job = {
        document,
        id: this.nextId,
        reject,
        resolve,
        signal: options.signal || null,
      };
      this.nextId += 1;
      job.abortHandler = () => this._abort(job);
      job.signal?.addEventListener("abort", job.abortHandler, { once: true });
      this.queue.push(job);
      if (this.active) {
        job.queueTimer = setTimeout(() => {
          if (!this._removeQueued(job)) return;
          this._cleanupJob(job);
          job.reject(createRenderError("IMAGE_RENDER_BUSY", "The image render queue wait time expired"));
        }, this.queueWaitMs);
      }
      this._startNext();
    });
  }

  async close() {
    this.closed = true;
    const error = createRenderError("IMAGE_RENDER_CLOSED", "Image renderer is closed");
    this.queue.splice(0).forEach((job) => {
      this._cleanupJob(job);
      job.reject(error);
    });
    if (this.active) {
      const active = this.active;
      this.active = null;
      this._cleanupJob(active);
      active.reject(error);
    }
    const worker = this.worker;
    this.worker = null;
    if (worker) await worker.terminate();
  }

  _spawnWorker() {
    if (this.closed || this.worker) return;
    const worker = new Worker(this.workerFile);
    this.worker = worker;
    worker.on("message", (message) => {
      if (worker !== this.worker) return;
      this._handleMessage(message);
    });
    worker.on("error", (error) => {
      if (worker !== this.worker) return;
      this._replaceWorker(createRenderError(
        "IMAGE_RENDER_FAILED",
        error.message || "The image render worker failed"
      ));
    });
    worker.on("exit", (code) => {
      if (worker !== this.worker || this.closed || code === 0) return;
      this._replaceWorker(createRenderError(
        "IMAGE_RENDER_FAILED",
        "The image render worker stopped unexpectedly"
      ));
    });
    worker.unref();
  }

  _startNext() {
    if (this.closed || this.active || this.queue.length === 0) return;
    this._spawnWorker();
    if (!this.worker) return;
    const job = this.queue.shift();
    clearTimeout(job.queueTimer);
    job.queueTimer = null;
    this.active = job;
    this.worker.ref();
    job.renderTimer = setTimeout(() => {
      if (this.active !== job) return;
      this._replaceWorker(createRenderError(
        "IMAGE_RENDER_TIMEOUT",
        "The image render deadline expired"
      ));
    }, this.renderTimeoutMs);
    this.worker.postMessage({ document: job.document, id: job.id });
  }

  _handleMessage(message) {
    const job = this.active;
    if (!job || message?.id !== job.id) return;
    this.active = null;
    this.worker?.unref();
    this._cleanupJob(job);
    if (message.error) {
      job.reject(createRenderError(message.error.code, message.error.message));
    } else {
      job.resolve(Buffer.from(message.png));
    }
    this._startNext();
  }

  _replaceWorker(error) {
    const job = this.active;
    this.active = null;
    if (job) {
      this._cleanupJob(job);
      job.reject(error);
    }
    const worker = this.worker;
    this.worker = null;
    const finish = worker ? worker.terminate() : Promise.resolve();
    finish.finally(() => {
      if (this.closed) return;
      this._spawnWorker();
      this._startNext();
    });
  }

  _abort(job) {
    if (this._removeQueued(job)) {
      this._cleanupJob(job);
      job.reject(createRenderError("IMAGE_RENDER_ABORTED", "Image rendering was cancelled"));
    }
  }

  _removeQueued(job) {
    const index = this.queue.indexOf(job);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    return true;
  }

  _cleanupJob(job) {
    clearTimeout(job.queueTimer);
    clearTimeout(job.renderTimer);
    job.signal?.removeEventListener("abort", job.abortHandler);
    job.document = null;
  }
}

module.exports = {
  RenderWorkerQueue,
  createRenderError,
};
