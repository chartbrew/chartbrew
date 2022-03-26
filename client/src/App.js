import React from "react";
import { Provider } from "react-redux";

import { createBrowserHistory } from "history";
import { ConnectedRouter, routerMiddleware } from "connected-react-router";
import { createStore, applyMiddleware, compose } from "redux";
import thunk from "redux-thunk";
import logger from "redux-logger";

import Main from "./containers/Main";
import reducer from "./reducers";

const history = createBrowserHistory();

let middlewares = [thunk, routerMiddleware(history)];

if (process.env.NODE_ENV !== "production") {
  middlewares = [...middlewares, logger];
}

const store = createStore(
  reducer(history),
  undefined,
  compose(applyMiddleware(...middlewares)),
);

export default class App extends React.Component {
  render() {
    return (
      <Provider store={store}>
        <ConnectedRouter history={history}>
          <Main />
        </ConnectedRouter>
      </Provider>
    );
  }
}
