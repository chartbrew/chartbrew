import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { reportColorVariables } from "../../../shared/reportAppearance.mjs";

const ThemeContext = createContext();

export function ReportThemeProvider({ mode, colors, children }) {
  const parent = useContext(ThemeContext);
  const value = useMemo(() => ({
    ...parent,
    theme: mode,
    isDark: mode === "dark",
    reportColors: colors,
    reportThemeProps: { "data-theme": mode, style: reportColorVariables(colors) },
  }), [parent, mode, colors]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const ThemeProvider = ({ children }) => {
  const THEME_KEY = "cb_theme";

  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
      return savedTheme;
    }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  };

  const [theme, setThemeState] = useState(getInitialTheme());
  const [isDark, setIsDark] = useState(() => theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches));

  const setTheme = useCallback((newTheme) => {
    localStorage.setItem(THEME_KEY, newTheme);
    setThemeState(newTheme);
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefersDark);
    } else {
      setIsDark(newTheme === "dark");
    }
  }, []);

  useEffect(() => {
    const handleSystemThemeChange = (e) => {
      if (theme === "system") {
        setIsDark(e.matches);
      }
    };

    const systemMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemMediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      systemMediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  useEffect(() => {
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefersDark);
    } else {
      setIsDark(theme === "dark");
    }
  }, [theme]);

  useEffect(() => {
    const nextTheme = isDark ? "dark" : "light";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.body.classList.remove("light", "dark");
    document.body.classList.add(nextTheme);
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  return useContext(ThemeContext);
};
