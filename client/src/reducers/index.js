import { combineReducers } from "redux";
import { routerReducer } from "react-router-redux";
import { reducer as formReducer } from "redux-form";

// individual reducers imports
import user from "./user";
import project from "./project";
import team from "./team";
import chart from "./chart";
import connection from "./connection";
import savedQuery from "./savedQuery";
import error from "./error";

const AppReducer = combineReducers({
  user,
  project,
  form: formReducer,
  team,
  chart,
  connection,
  savedQuery,
  error,
  route: routerReducer,
});

export default AppReducer;
