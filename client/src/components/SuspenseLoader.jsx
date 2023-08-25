import React from "react";
import { CircularProgress } from "@nextui-org/react";

function SuspenseLoader() {
  return (
    <CircularProgress aria-label="Loading" />
  );
}

export default SuspenseLoader;
