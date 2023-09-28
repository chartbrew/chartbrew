import { useEffect, useState } from "react";
import useDarkMode from "@fisch0920/use-dark-mode";

const useThemeDetector = () => {
  const { value: isDarkOn } = useDarkMode(false);
  const getCurrentTheme = (e = null) => {
    let isDark = false;

    if (isDarkOn) {
      isDark = true;
    }
    
    if (localStorage.getItem("osTheme") === "true") {
      if (e) {
        isDark = e.matches;
      } else {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
    }

    return isDark;
  }

  const [isDarkTheme, setIsDarkTheme] = useState(getCurrentTheme());
  
  const mqListener = (e => {
    setIsDarkTheme(getCurrentTheme(e));
  });

  useEffect(() => {
    const darkThemeMq = window.matchMedia("(prefers-color-scheme: dark)")
      ?.addEventListener("change", mqListener);
    return () => darkThemeMq?.removeEventListener("change", mqListener);
  }, []);

  useEffect(() => {
    setIsDarkTheme(getCurrentTheme());
  }, [isDarkOn]);

  return isDarkTheme;
};

export default useThemeDetector;
