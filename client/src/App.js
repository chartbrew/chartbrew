import React from "react";
import { Provider } from "react-redux";

import createHistory from "history/createBrowserHistory";

import { ConnectedRouter, routerMiddleware } from "react-router-redux";

import { createStore, applyMiddleware, compose } from "redux";
import thunk from "redux-thunk";
import logger from "redux-logger";

import Main from "./containers/Main";
import reducer from "./reducers";

const history = createHistory();

let middlewares = [thunk, routerMiddleware(history)];

// if (process.env.NODE_ENV !== "production") {
//   middlewares = [...middlewares, logger];
// }

const store = createStore(
  reducer,
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
