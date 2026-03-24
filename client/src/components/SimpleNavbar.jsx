import React from "react";

import { useTheme } from "../modules/ThemeContext";
import cbLogoDark from "../assets/cb_logo_dark.svg";
import cbLogoLight from "../assets/cb_logo_light.svg";
import { SITE_HOST } from "../config/settings";

function SimpleNavbar() {
  const { isDark } = useTheme();

  return (
    <header className="z-50 border-b border-divider bg-background">
      <div className="flex items-center justify-between px-4 py-3">
        <a href={`${SITE_HOST}`}>
          <img alt="Chartbrew Logo" src={isDark ? cbLogoDark : cbLogoLight} width={150} />
        </a>
        <nav className="flex items-center gap-4 text-sm">
          <a className="text-foreground hover:text-primary" href="/login">
            Login
          </a>
          <a className="text-foreground hover:text-primary" href="/signup">
            Sign Up
          </a>
        </nav>
      </div>
    </header>
  );
}

export default SimpleNavbar;
