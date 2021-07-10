import React from "react";
import ReactDOM from "react-dom";
// disable eslint for the line below to fix the CI
import "./semantic/dist/semantic.min.css"; // eslint-disable-line

import "./index.css";

import App from "./App";
import { unregister } from "./registerServiceWorker";

unregister();

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
