import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { Router } from "react-router";
import { createBrowserHistory } from "history";
import { createReduxHistoryContext } from "redux-first-history";
import { createStore, applyMiddleware, compose } from "redux";
import thunk from "redux-thunk";
import logger from "redux-logger";
import { NextUIProvider } from "@nextui-org/react";
import { IconlyProvider } from "react-iconly";
import { IconContext } from "react-icons";

import Main from "./containers/Main";
import reducer from "./reducers";
import useThemeDetector from "./modules/useThemeDetector";

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
  const isDark = useThemeDetector();

  useEffect(() => {
    if (isDark) {
      document.body.classList.add("dark");
      document.body.classList.remove("light");
    } else {
      document.body.classList.add("light");
      document.body.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <Provider store={store}>
      <Router history={history}>
        <NextUIProvider>
          <IconContext.Provider value={{ className: "react-icons", size: 20, style: { opacity: 0.8 } }}>
            <IconlyProvider set="bulk">
              <Main />
            </IconlyProvider>
          </IconContext.Provider>
        </NextUIProvider>
      </Router>
    </Provider>
  );
}
