import React from "react";
import { Provider } from "react-redux";
import {
  createBrowserRouter, RouterProvider,
} from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { HeroUIProvider } from "@heroui/react";

import Main from "./containers/Main";
import reducer from "./reducers";
import { ThemeProvider } from "./modules/ThemeContext";

const store = configureStore({
  reducer,
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <Main />,
    children: [
      {
        path: "user",
        children: [{
          path: "profile",
        }]
      },
      {
        path: "edit",
      },
      {
        path: "dashboards",
      },
      {
        path: "connections",
      },
      {
        path: "datasets",
      },
      {
        path: "integrations",
      },
      {
        path: "chart/:chartId/embedded",
      },
      {
        path: "invite",
      },
      {
        path: "b/:brewName",
      },
      {
        path: "login",
      },
      {
        path: "signup",
      },
      {
        path: "google-auth",
      },
      {
        path: "passwordReset"
      },
      {
        path: "feedback",
      },
      {
        path: "manage/:teamId",
        children: [
          {
            path: "members",
          },
          {
            path: "settings",
          },
          {
            path: "api-keys",
          },
        ],
      },
      {
        path: ":teamId/:projectId",
        children: [
          {
            path: "connections",
          },
          {
            path: "dashboard",
          },
          {
            path: "chart",
          },
          {
            path: "chart/:chartId/edit",
          },
          {
            path: "members",
          },
          {
            path: "settings",
          },
          {
            path: "integrations",
          },
          {
            path: "variables",
          }
        ],
      },
      {
        path: ":teamId/dataset/:datasetId",
      },
      {
        path: ":teamId/connection/:connectionId",
      },
    ],
  },
]);

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <HeroUIProvider locale="en-GB">
          <RouterProvider router={router} />
        </HeroUIProvider>
      </ThemeProvider>
    </Provider>
  );
}
