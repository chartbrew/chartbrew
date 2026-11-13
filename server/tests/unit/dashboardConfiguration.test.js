import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { getReportOrder } from "../../../shared/dashboard/layout.mjs";

describe("dashboard configuration", () => {
  it("returns ordered widget settings without loading chart data", async () => {
    const project = { Charts: [{ id: 1 }, { id: 2 }], layoutOrder: ["2", "1"] };
    const findOne = vi.fn().mockResolvedValue(project);
    const hydratePreparedCharts = vi.fn();
    const context = vm.createContext({
      module: { exports: {} },
      require: (name) => {
        if (name === "../../shared/dashboard/layout.mjs") return { getReportOrder };
        if (name === "../models/models") return { Project: { findOne } };
        if (name === "./TeamController") return class {};
        if (name === "./ChartController") return class { hydratePreparedCharts = hydratePreparedCharts; };
        return {};
      },
    });
    vm.runInContext(readFileSync(new URL("../../controllers/ProjectController.js", import.meta.url), "utf8"), context);
    const controller = new context.module.exports();
    const result = await controller.findById(7, { hydratePreparedData: false, includeDrafts: false });
    expect(result).toBe(project);
    expect(result.Charts.map(({ id }) => id)).toEqual([2, 1]);
    expect(hydratePreparedCharts).not.toHaveBeenCalled();
    expect(findOne.mock.calls[0][0].where).toEqual({ id: 7 });
    expect(findOne.mock.calls[0][0].include[0].where).toEqual({ draft: false });

    project.setDataValue = vi.fn();
    hydratePreparedCharts.mockResolvedValue(project.Charts);
    await controller.findById(7);
    expect(hydratePreparedCharts).toHaveBeenCalledOnce();
  });
});
