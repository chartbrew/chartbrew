const Sequelize = require("sequelize");
const cloneDeep = require("lodash/cloneDeep");

const db = require("../models");

function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Chart", "layout", {
      type: Sequelize.TEXT,
      defaultValue: JSON.stringify({
        "lg": [0, 0, 6, 2],
        "md": [0, 0, 6, 2],
        "sm": [0, 0, 4, 2],
        "xs": [0, 0, 4, 2],
        "xxs": [0, 0, 2, 2]
      }),
      set(val) {
        return this.setDataValue("layout", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("layout"));
        } catch (e) {
          return this.getDataValue("layout");
        }
      }
    });

    // Update all charts to have the new layout
    const projects = await db.Project.findAll({
      include: [{ model: db.Chart, attributes: ["id", "chartSize", "dashboardOrder"] }],
      attributes: ["id"],
    });

    const updatePromises = [];

    const getWidth = (size, breakpoint) => {
      if (size === 1) {
        switch (breakpoint) {
          case "lg":
            return 3;
          case "md":
            return 3;
          case "sm":
            return 3;
          case "xs":
            return 2;
          case "xxs":
            return 2;
          default:
            return 0;
        }
      } else if (size === 2) {
        switch (breakpoint) {
          case "lg":
            return 6;
          case "md":
            return 6;
          case "sm":
            return 4;
          case "xs":
            return 4;
          case "xxs":
            return 2;
          default:
            return 0;
        }
      } else if (size === 3) {
        switch (breakpoint) {
          case "lg":
            return 9;
          case "md":
            return 8;
          case "sm":
            return 6;
          case "xs":
            return 4;
          case "xxs":
            return 2;
          default:
            return 0;
        }
      } else {
        switch (breakpoint) {
          case "lg":
            return 12;
          case "md":
            return 10;
          case "sm":
            return 6;
          case "xs":
            return 4;
          case "xxs":
            return 2;
          default:
            return 0;
        }
      }
    };

    projects.forEach((project) => {
      if (project.Charts?.length > 0) {
        const currentLayout = {
          "lg": [0, 0, 0, 2],
          "md": [0, 0, 0, 2],
          "sm": [0, 0, 0, 2],
          "xs": [0, 0, 0, 2],
          "xxs": [0, 0, 0, 2]
        };
        project.Charts.sort((a, b) => a.dashboardOrder - b.dashboardOrder).forEach((chart) => {
          const layout = {};

          // now update the currentLayout with the final layout
          ["lg", "md", "sm", "xs", "xxs"].forEach((bp) => {
            const width = getWidth(chart.chartSize, bp);
            if (currentLayout[bp][0] + width > 12) {
              currentLayout[bp][0] = 0;
              currentLayout[bp][1] += currentLayout[bp][3];
            }

            // Assign layout values for this chart
            layout[bp] = [currentLayout[bp][0], currentLayout[bp][1], width, currentLayout[bp][3]];

            // Update currentLayout x position for the next chart
            currentLayout[bp][0] += width;
          });

          updatePromises.push(db.Chart.update(
            { layout: cloneDeep(layout) },
            { where: { id: chart.id } }
          ));
        });
      }
    });

    await throttlePromises(updatePromises, 5, 0);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Chart", "layout");
  }
};
