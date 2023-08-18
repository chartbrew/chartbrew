/* eslint-disable import/prefer-default-export */
import { styled } from "@nextui-org/react";

// IconButton component will be available as part of the core library soon
export const IconButton = styled("button", {
  dflex: "center",
  border: "none",
  outline: "none",
  cursor: "pointer",
  padding: "0",
  margin: "0",
  bg: "transparent",
  transition: "$default",
  "&:hover": {
    opacity: "0.8"
  },
  "&:active": {
    opacity: "0.6"
  }
});
