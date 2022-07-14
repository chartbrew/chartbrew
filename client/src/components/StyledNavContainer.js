import { styled } from "@nextui-org/react";

const StyledNavContainer = styled("div", {
  display: "flex",
  alignItems: "center",
  size: "100%",
  "& .navbar__social-icon": {
    fill: "$colors$accents6"
  },
  variants: {
    showBlur: {
      true: {
        background: "$background",
        "@supports ((-webkit-backdrop-filter: none) or (backdrop-filter: none))":
          {
            background: "$headerBackground"
          }
      }
    },
    detached: {
      true: {
        backdropFilter: "saturate(180%) blur(10px)",
        boxShadow: "0px 5px 20px -5px rgba(2, 1, 1, 0.1)"
      },
      false: {
        backdropFilter: "none",
        boxShadow: "none",
        background: "transparent"
      }
    }
  }
});

export default StyledNavContainer;
