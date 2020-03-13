import React from "react";
import ReactDOM from "react-dom";
import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file
// disable eslint for the line below to fix the CI
import "./semantic/dist/semantic.min.css"; // eslint-disable-line

import "./index.css";

import App from "./App";
import { unregister } from "./registerServiceWorker";

unregister();

ReactDOM.render(<App />, document.getElementById("root"));
