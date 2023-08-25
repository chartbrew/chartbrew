import React from "react";
import { Provider } from "react-redux";
import { Router } from "react-router";
import { createBrowserHistory } from "history";
import { createReduxHistoryContext } from "redux-first-history";
import { createStore, applyMiddleware, compose } from "redux";
import thunk from "redux-thunk";
import logger from "redux-logger";
import { NextUIProvider } from "@nextui-org/react";
import { IconlyProvider } from "react-iconly";

import Main from "./containers/Main";
import reducer from "./reducers";

const { createReduxHistory, routerMiddleware, routerReducer } = createReduxHistoryContext({
  history: createBrowserHistory(),
  //other options if needed 
});

let middlewares = [thunk, routerMiddleware];

if (import.meta.env.DEV) {
  middlewares = [...middlewares, logger];
}

const store = createStore(
  reducer(routerReducer),
  undefined,
  compose(applyMiddleware(...middlewares)),
);

const history = createReduxHistory(store);

export default function App() {
  return (
    <Provider store={store}>
      <Router history={history}>
        <NextUIProvider>
          <IconlyProvider set="bulk">
            <Main />
          </IconlyProvider>
        </NextUIProvider>
      </Router>
    </Provider>
  );
}
