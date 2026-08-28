import { describe, expect, it, vi } from "vitest";

const ChartImageController = require("../../controllers/ChartImageController");

function request() {
  return {
    body: { version: 1 },
    id: "request-1",
    params: { chart_id: "7", project_id: "5" },
    user: { id: 2 },
  };
}

describe("ChartImageController", () => {
  it("runs authorization, document loading, and rendering in order", async () => {
    const calls = [];
    const controller = new ChartImageController({
      authorize: vi.fn(async () => {
        calls.push("authorize");
        return { chartId: 7, projectId: 5, teamId: 3, userId: 2 };
      }),
      loadDocument: vi.fn(async () => {
        calls.push("load");
        return { document: { safe: true }, operationalCodes: [], preset: "line" };
      }),
      queue: {
        render: vi.fn(async () => {
          calls.push("render");
          return Buffer.from("png");
        }),
      },
      recordEvent: vi.fn(() => calls.push("log")),
    });
    await expect(controller.render(request())).resolves.toEqual(Buffer.from("png"));
    expect(calls).toEqual(["authorize", "load", "render", "log"]);
  });

  it("does not load chart data or render after denied access", async () => {
    const loadDocument = vi.fn();
    const queue = { render: vi.fn() };
    const controller = new ChartImageController({
      authorize: vi.fn().mockRejectedValue(Object.assign(new Error("private"), {
        code: "IMAGE_EXPORT_FORBIDDEN",
      })),
      loadDocument,
      queue,
      recordEvent: vi.fn(),
    });
    await expect(controller.render(request())).rejects.toMatchObject({
      code: "IMAGE_EXPORT_FORBIDDEN",
      message: "You do not have permission to export this chart.",
    });
    expect(loadDocument).not.toHaveBeenCalled();
    expect(queue.render).not.toHaveBeenCalled();
  });

  it("keeps render results independent from operational logging", async () => {
    const controller = new ChartImageController({
      authorize: vi.fn().mockResolvedValue({ chartId: 7, projectId: 5, teamId: 3, userId: 2 }),
      loadDocument: vi.fn().mockResolvedValue({
        document: { safe: true },
        operationalCodes: [],
        preset: "line",
      }),
      queue: { render: vi.fn().mockResolvedValue(Buffer.from("png")) },
      recordEvent: vi.fn(() => { throw new Error("logger failed"); }),
    });
    await expect(controller.render(request())).resolves.toEqual(Buffer.from("png"));
  });

  it("maps unexpected failures to the stable public error", async () => {
    const controller = new ChartImageController({
      authorize: vi.fn().mockRejectedValue(new Error("database path and secret")),
      recordEvent: vi.fn(),
    });
    await expect(controller.render(request())).rejects.toMatchObject({
      code: "IMAGE_RENDER_FAILED",
      message: "The image could not be created.",
      statusCode: 500,
    });
  });
});
