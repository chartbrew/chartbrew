const paramsToParse = ["project_id", "team_id", "user_id", "dataset_id", "dataRequest_id"];

const parseQueryParams = (req, res, next) => {
  const hasInvalidParam = paramsToParse.some((param) => {
    if (param in req.query) {
      const parsed = parseInt(req.query[param], 10);

      if (Number.isNaN(parsed) || !Number.isInteger(parsed)) {
        res.status(400).json({ message: `Invalid ${param}` });
        return true;
      }

      req.query[param] = parsed;
    }
    return false;
  });

  if (!hasInvalidParam) {
    next();
  }
};

module.exports = parseQueryParams;
