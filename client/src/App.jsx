import React from "react";
import { Provider } from "react-redux";
import {
  createBrowserRouter, RouterProvider,
} from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { HelmetProvider } from "react-helmet-async";

import Main from "./containers/Main";
import reducer from "./reducers";
import { ThemeProvider } from "./modules/ThemeContext";

const store = configureStore({
  reducer,
});

const router = createBrowserRouter([
  {
    element: <Main />,
    path: "*",
  },
]);

export default function App() {
  return (
    <Provider store={store}>
      <HelmetProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </HelmetProvider>
    </Provider>
  );
}
