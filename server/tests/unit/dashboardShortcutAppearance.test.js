import { expect, it } from "vitest";
import { Sequelize, DataTypes } from "sequelize";

const makeProject = require("../../models/models/project");
const shortcutOptions = require("../../../shared/dashboard/shortcut-options.json");

it("saves dashboard shortcuts and rejects unknown choices", async () => {
  const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
  const Project = makeProject(sequelize, DataTypes);
  await Project.sync();
  const project = await Project.create({ team_id: 1, name: "Revenue" });

  expect([project.sidebarIcon, project.sidebarColor, project.sidebarDisplay]).toEqual(["grid", "blue", "icon"]);
  await Project.update({
    sidebarIcon: shortcutOptions.icons.at(-1),
    sidebarColor: shortcutOptions.colors.at(-1),
    sidebarDisplay: "logo",
  }, { where: { id: project.id } });
  const saved = await Project.findByPk(project.id);
  expect([saved.sidebarIcon, saved.sidebarColor, saved.sidebarDisplay]).toEqual(["zap", "slate", "logo"]);

  await Project.update({ sidebarColor: "neutral" }, { where: { id: project.id } });
  await saved.reload();
  expect(saved.sidebarColor).toBe("neutral");

  for (const field of ["sidebarIcon", "sidebarColor", "sidebarDisplay"]) {
    await expect(Project.update({ [field]: "unknown" }, { where: { id: project.id } }))
      .rejects.toMatchObject({ name: "SequelizeValidationError" });
  }

  await sequelize.close();
});
