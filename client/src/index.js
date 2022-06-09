import React from "react";
import ReactDOM from "react-dom";
import { createTheme, NextUIProvider } from "@nextui-org/react";

// disable eslint for the line below to fix the CI
import "./semantic/dist/semantic.min.css"; // eslint-disable-line

import "./index.css";

import { primary, primaryTransparent } from "./config/colors";
import App from "./App";
import { unregister } from "./registerServiceWorker";

unregister();

const theme = createTheme({
  type: "light", // it could be "light" or "dark"
  theme: {
    colors: {
      // brand colors
      primaryLight: primaryTransparent(0.9),
      primaryLightHover: primaryTransparent(0.8),
      primaryLightActive: primaryTransparent(0.7),
      primaryLightContrast: primary,
      primary,
      primaryBorder: "$green500",
      primaryBorderHover: "$green600",
      primarySolidHover: "$green700",
      primarySolidContrast: "$white",
      primaryShadow: "$green500",

      gradient: "linear-gradient(112deg, $blue100 -25%, $pink500 -10%, $purple500 80%)",
      link: "#5E1DAD",

      // you can also create your own color
      myColor: "#ff4ecd"

      // ...  more colors
    },
    space: {},
    fonts: {}
  }
});

ReactDOM.render(
  <React.StrictMode>
    <NextUIProvider theme={theme}>
      <App />
    </NextUIProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
