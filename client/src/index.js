import React from "react";
import ReactDOM from "react-dom";
import { NextUIProvider } from "@nextui-org/react";
import { IconlyProvider } from "react-iconly";

// disable eslint for the line below to fix the CI
// import "./semantic/dist/semantic.min.css"; // eslint-disable-line

import "./index.css";

import App from "./App";
import { unregister } from "./registerServiceWorker";
import getThemeConfig from "./theme";

unregister();

const theme = getThemeConfig();

ReactDOM.render(
  <React.StrictMode>
    <NextUIProvider theme={theme}>
      <IconlyProvider set="bulk">
        <App />
      </IconlyProvider>
    </NextUIProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
