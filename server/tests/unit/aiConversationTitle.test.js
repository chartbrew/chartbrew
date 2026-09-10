import { expect, it } from "vitest";

const { getConversationTitle } = require("../../controllers/AiController");

it("uses a short first question instead of generic titles and keeps descriptive names", () => {
  for (const title of [null, "", "Saved conversation", "New Conversation", "Quick Action"]) {
    expect(getConversationTitle(title, "  Show visits\n by country  ")).toBe("Show visits by country");
  }
  expect(getConversationTitle("Monthly revenue", "Now show visitors")).toBe("Monthly revenue");
  expect(getConversationTitle(null, "a".repeat(300))).toBe(`${"a".repeat(117)}…`);
  expect(getConversationTitle(null, null)).toBe("Untitled conversation");
});
