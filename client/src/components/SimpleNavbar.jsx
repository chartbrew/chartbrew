import React from "react";
import { Button } from "@heroui/react";

import { useTheme } from "../modules/ThemeContext";
import cbLogoDark from "../assets/cb_logo_dark.svg";
import cbLogoLight from "../assets/cb_logo_light.svg";
import { SITE_HOST } from "../config/settings";

function SimpleNavbar() {
  const { isDark } = useTheme();

  return (
    <header className="z-50 border-b border-divider bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <a href={`${SITE_HOST}`}>
          <img alt="Chartbrew Logo" src={isDark ? cbLogoDark : cbLogoLight} width={132} />
        </a>
        <nav className="flex items-center gap-2" aria-label="Account">
          <Button
            size="sm"
            variant="ghost"
            className="text-foreground!"
            render={(props) => <a {...props} href="/login" />}
          >
            Login
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="text-foreground!"
            render={(props) => <a {...props} href="/signup" />}
          >
            Sign Up
          </Button>
        </nav>
      </div>
    </header>
  );
}

export default SimpleNavbar;
