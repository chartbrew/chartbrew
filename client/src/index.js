import React from "react";
import ReactDOM from "react-dom";
import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file
import "./index.css";
import "./semantic/dist/semantic.min.css";

import App from "./App";
import { unregister } from "./registerServiceWorker";

unregister();

ReactDOM.render(<App />, document.getElementById('root')); // eslint-disable-line
