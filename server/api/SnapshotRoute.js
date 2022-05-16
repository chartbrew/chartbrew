const SnapshotController = require("../controllers/SnapshotController");
const verifyToken = require("../modules/verifyToken");

module.exports = (app) => {
  app.get("/snapshot/chart/:id", verifyToken, (req, res) => {
    return SnapshotController.snapChart()
      .then(() => {
        return res.status(200).send("done");
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });

  return (req, res, next) => {
    next();
  };
};
