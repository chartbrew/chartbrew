import React from "react";
import { Provider } from "react-redux";
import {
  createBrowserRouter, RouterProvider,
} from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { HeroUIProvider } from "@heroui/react";
import { HelmetProvider } from "react-helmet-async";

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
        path: "connections/:connectionId",
      },
      {
        path: "datasets",
      },
      {
        path: "datasets/:datasetId",
      },
      {
        path: "integrations",
        children: [
          {
            path: "auth/:integrationType",
          },
          {
            path: "auth/:integrationType/callback",
          }
        ],
      },
      {
        path: "settings",
        children: [
          {
            path: "profile"
          },
          {
            path: "team",
          },
          {
            path: "members",
          },
          {
            path: "api-keys",
          },
        ],
      },
      {
        path: "dashboard/:projectId",
        children: [
          {
            path: "chart",
          },
          {
            path: "chart/:chartId/edit",
          },
        ]
      },
      {
        path: "chart/:chartId/embedded",
      },
      {
        path: "chart/:share_string/share",
      },
      {
        path: "invite",
      },
      {
        path: "b/:brewName",
      },
      {
        path: "report/:brewName",
      },
      {
        path: "report/:brewName/edit",
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
    ],
  },
]);

export default function App() {
  return (
    <Provider store={store}>
      <HelmetProvider>
        <ThemeProvider>
          <HeroUIProvider locale="en-GB">
            <RouterProvider router={router} />
          </HeroUIProvider>
        </ThemeProvider>
      </HelmetProvider>
    </Provider>
  );
}
