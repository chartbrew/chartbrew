import { combineReducers } from "redux";
import { routerReducer } from "react-router-redux";

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

const AppReducer = combineReducers({
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
  route: routerReducer,
});

export default AppReducer;
