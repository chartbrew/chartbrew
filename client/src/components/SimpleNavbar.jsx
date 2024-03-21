import React from "react";
import {
  Image, Navbar, Link as LinkNext, NavbarBrand, NavbarContent, NavbarItem,
} from "@nextui-org/react";

import Text from "./Text";
import useThemeDetector from "../modules/useThemeDetector";
import cbLogoDark from "../assets/logo_full_dark.png";
import cbLogoLight from "../assets/logo_full_light.png";

function SimpleNavbar() {
  const isDark = useThemeDetector();

  return (
    <Navbar maxWidth={"full"} className="z-50">
      <NavbarBrand>
        <a href="https://chartbrew.com">
          <Image src={isDark ? cbLogoDark : cbLogoLight} alt="Chartbrew Logo" width={150} radius="sm" />
        </a>
      </NavbarBrand>
      <NavbarContent justify="flex-end">
        <NavbarItem>
          <LinkNext href="/login">
            <Text>Login</Text>
          </LinkNext>
        </NavbarItem>
        <NavbarItem>
          <LinkNext href="/signup">
            <Text>Sign Up</Text>
          </LinkNext>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}

export default SimpleNavbar;
