// individual reducers imports
import user from "../slices/user";
import project from "../slices/project";
import team from "../slices/team";
import chart from "../slices/chart";
import connection from "../slices/connection";
import savedQuery from "../slices/savedQuery";
import error from "./error";
import dataset from "../slices/dataset";
import dataRequest from "./dataRequest";
import tutorial from "./tutorial";
import template from "../slices/template";
import alert from "../slices/alert";
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
