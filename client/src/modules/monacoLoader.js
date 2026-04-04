import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

let themesRegistered = false;

if (typeof self !== "undefined") {
  self.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === "json") return new jsonWorker();
      if (label === "css" || label === "scss" || label === "less") return new cssWorker();
      if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
      if (label === "typescript" || label === "javascript") return new tsWorker();

      return new editorWorker();
    },
  };
}

loader.config({ monaco });

export const ensureMonacoThemes = (monacoInstance) => {
  if (themesRegistered) {
    return;
  }

  monacoInstance.editor.defineTheme("chartbrew-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editorLineNumber.foreground": "#71717a",
      "editorLineNumber.activeForeground": "#11181c",
    },
  });

  monacoInstance.editor.defineTheme("chartbrew-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#050f14",
      "editorLineNumber.foreground": "#71717a",
      "editorLineNumber.activeForeground": "#ecedee",
    },
  });

  themesRegistered = true;
};

export { loader, monaco };
