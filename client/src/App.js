import React from "react";
import { Provider } from "react-redux";

import { createBrowserHistory } from "history";
import { ConnectedRouter, routerMiddleware } from "connected-react-router";
import { createStore, applyMiddleware, compose } from "redux";
import thunk from "redux-thunk";
import logger from "redux-logger";
import useDarkMode from "@fisch0920/use-dark-mode";
import { NextUIProvider } from "@nextui-org/react";
import { IconlyProvider } from "react-iconly";

import Main from "./containers/Main";
import reducer from "./reducers";
import getThemeConfig from "./theme";
import useThemeDetector from "./modules/useThemeDetector";

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

export default function App() {
  const darkMode = useDarkMode(window.localStorage.getItem("darkMode"));
  const isDark = useThemeDetector();

  const _getTheme = () => {
    if (darkMode.value === true) {
      return getThemeConfig("dark");
    } else if (darkMode.value === false) {
      return getThemeConfig("light");
    } else {
      return getThemeConfig(isDark ? "dark" : "light");
    }
  };

  return (
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <NextUIProvider theme={_getTheme()}>
          <IconlyProvider set="bulk">
            <Main />
          </IconlyProvider>
        </NextUIProvider>
      </ConnectedRouter>
    </Provider>
  );
}
