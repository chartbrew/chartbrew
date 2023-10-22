// individual reducers imports
import user from "./user";
import project from "./project";
import team from "../slices/team";
import chart from "../slices/chart";
import connection from "./connection";
import savedQuery from "./savedQuery";
import error from "./error";
import dataset from "../slices/dataset";
import dataRequest from "./dataRequest";
import tutorial from "./tutorial";
import template from "./template";
import alert from "./alert";
import integration from "./integration";

const AppReducer = {
  user,
  project,
  team,
  chart,
  connection,
  savedQuery,
  dataset,
  dataRequest,
  error,
  tutorial,
  template,
  alert,
  integration,
};

export default AppReducer;
