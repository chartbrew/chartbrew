import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import PropTypes from "prop-types";
import { transformWithOxc } from "vite";

const modules = {
  react: {
    default: React,
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useState: (value) => [value, () => {}],
  },
  "prop-types": { default: PropTypes },
  "@heroui/react": {
    Button: "button", Chip: "chip", Kbd: "kbd", Label: "label",
    ScrollShadow: "scroll", TextField: "field",
    InputGroup: Object.assign(() => null, { TextArea: "textarea" }),
    Tooltip: Object.assign(() => null, { Trigger: "trigger", Content: "content" }),
  },
  "react-icons/lu": { LuArrowUp: "arrow" },
  "./homeSuggestionState": { keepSuggestionOrder: () => [] },
  "../../components/PixelLoader": { default: "loader" },
};
const context = vm.createContext({});
const source = await readFile(new URL("./AiComposer.jsx", import.meta.url), "utf8");
const { code } = await transformWithOxc(source, "AiComposer.jsx", { jsx: { runtime: "classic" } });
const mod = new vm.SourceTextModule(code, { context });
await mod.link((name) => new vm.SyntheticModule(Object.keys(modules[name]), function() {
  Object.entries(modules[name]).forEach(([key, value]) => this.setExport(key, value));
}, { context }));
await mod.evaluate();

function find(element, type) {
  if (!React.isValidElement(element)) return null;
  if (element.type === type) return element;
  return React.Children.toArray(element.props.children).map((child) => find(child, type)).find(Boolean);
}

for (const isDisabled of [true, false]) {
  test(`composer ${isDisabled ? "blocks" : "allows"} submission when disabled=${isDisabled}`, () => {
    const submitted = [];
    const composer = mod.namespace.default({
      id: "test", name: "question", placeholder: "Describe a chart",
      value: "Revenue by month", isLoading: false, isDisabled,
      selectedContext: { multiSelect: [] },
      onSubmitQuestion: (value) => { submitted.push(value); return false; },
    });
    assert.equal(find(composer, "field").props.isDisabled, isDisabled);
    const sendButton = find(composer, "trigger").props.render({});
    assert.equal(sendButton.props.isDisabled, isDisabled);
    assert.equal(sendButton.props["aria-busy"], false);
    find(composer, "form").props.onSubmit({ preventDefault() {} });
    find(composer, "textarea").props.onKeyDown({ key: "Enter", preventDefault() {} });
    assert.deepEqual(submitted, isDisabled ? [] : ["Revenue by month", "Revenue by month"]);
  });
}
