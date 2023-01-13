import { combineReducers } from "redux";
import { connectRouter } from "connected-react-router";

// individual reducers imports
import user from "./user";
import project from "./project";
import team from "./team";
import chart from "./chart";
import connection from "./connection";
import savedQuery from "./savedQuery";
import error from "./error";
import dataset from "./dataset";
import dataRequest from "./dataRequest";
import tutorial from "./tutorial";
import template from "./template";
import alert from "./alert";
import integration from "./integration";

const AppReducer = (history) => combineReducers({
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
  router: connectRouter(history),
});

export default AppReducer;
