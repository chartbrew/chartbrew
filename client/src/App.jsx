import React, { useEffect } from "react";
import { Provider } from "react-redux";
import {
  createBrowserRouter, RouterProvider,
} from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { NextUIProvider } from "@nextui-org/react";

import Main from "./containers/Main";
import reducer from "./reducers";
import useThemeDetector from "./modules/useThemeDetector";

const store = configureStore({
  reducer,
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <Main />,
    children: [
      {
        path: "/user",
        children: [{
          path: "/user/profile",
        }]
      },
      {
        path: "/manage/:teamId",
        children: [
          {
            path: "/manage/:teamId/members",
          },
          {
            path: "/manage/:teamId/settings",
          },
          {
            path: "/manage/:teamId/api-keys",
          },
        ],
      }
    ],
  },
]);

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
      <NextUIProvider>
        <RouterProvider router={router} />
      </NextUIProvider>
    </Provider>
  );
}
