/**
 * Convert markdown text to Slack mrkdwn format (for use within blocks)
 */
function markdownToSlackMrkdwn(text) {
  if (!text) return "";

  let result = text;

  // Convert bold **text** to *text*
  result = result.replace(/\*\*(.*?)\*\*/g, "*$1*");

  // Convert links [text](url) to <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

  // Convert inline code `code` to `code` (Slack uses same syntax)
  // Already compatible

  return result.trim();
}

/**
 * Extract cb-actions from message
 */
function extractCbActions(message) {
  if (!message) return null;

  const cbActionsMatch = message.match(/```cb-actions\s*\n([\s\S]*?)\n```/);
  if (!cbActionsMatch) return null;

  try {
    const actions = JSON.parse(cbActionsMatch[1]);
    return actions;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to parse cb-actions:", e);
    return null;
  }
}

/**
 * Process code block and return updated index
 */
function processCodeBlock(lines, startIndex, blocks) {
  const codeLines = [];
  let i = startIndex + 1; // Skip opening ```

  while (i < lines.length && !lines[i].trim().startsWith("```")) {
    codeLines.push(lines[i]);
    i++;
  }
  i++; // Skip closing ```

  if (codeLines.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`${codeLines.join("\n")}\`\`\``,
      },
    });
  }

  return i;
}

/**
 * Process header and return updated index
 */
function processHeader(line, blocks) {
  const headerText = line.replace(/^#{1,3}\s+/, "");
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: headerText.substring(0, 150), // Headers have 150 char limit
    },
  });
  return 1; // Advance by 1
}

/**
 * Process bullet list and return updated index
 */
function processBulletList(lines, startIndex, blocks) {
  const listItems = [];
  let i = startIndex;

  while (i < lines.length && lines[i].match(/^[\s]*[-*•]\s+(.+)$/)) {
    const itemText = lines[i].replace(/^[\s]*[-*•]\s+/, "");
    listItems.push(`• ${markdownToSlackMrkdwn(itemText)}`);
    i++;
  }

  const listText = listItems.join("\n");
  if (listText.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: listText,
      },
    });
  }

  return i;
}

/**
 * Process numbered list and return updated index
 */
function processNumberedList(lines, startIndex, blocks) {
  const listItems = [];
  let i = startIndex;

  while (i < lines.length && lines[i].match(/^[\s]*\d+\.\s+(.+)$/)) {
    const itemText = lines[i].replace(/^[\s]*\d+\.\s+/, "");
    const num = lines[i].match(/^[\s]*(\d+)\./)[1];
    listItems.push(`${num}. ${markdownToSlackMrkdwn(itemText)}`);
    i++;
  }

  const listText = listItems.join("\n");
  if (listText.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: listText,
      },
    });
  }

  return i;
}

/**
 * Process regular text and return updated index
 */
function processRegularText(lines, startIndex, blocks) {
  const textLines = [];
  let i = startIndex;

  while (i < lines.length
         && lines[i].trim() !== ""
         && !lines[i].match(/^#{1,3}\s+/)
         && !lines[i].match(/^[\s]*[-*•]\s+/)
         && !lines[i].match(/^[\s]*\d+\.\s+/)
         && !lines[i].trim().startsWith("```")) {
    textLines.push(lines[i]);
    i++;
  }

  if (textLines.length > 0) {
    const textBlock = markdownToSlackMrkdwn(textLines.join("\n"));
    if (textBlock.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: textBlock,
        },
      });
    }
  }

  return i;
}

/**
 * Parse markdown message into Slack Block Kit blocks
 */
function parseMessageToBlocks(message) {
  if (!message) return null;

  const blocks = [];

  // Extract cb-actions before removing them
  const cbActions = extractCbActions(message);

  // Remove cb-actions blocks (will add as Slack buttons instead)
  const cleanMessage = message.replace(/```cb-actions[\s\S]*?```/g, "");

  // Split by lines for processing
  const lines = cleanMessage.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
    } else if (line.trim().startsWith("```")) {
      // Code blocks
      i = processCodeBlock(lines, i, blocks);
    } else if (line.match(/^#{1,3}\s+(.+)$/)) {
      // Headers
      i += processHeader(line, blocks);
    } else if (line.match(/^[\s]*[-*•]\s+(.+)$/)) {
      // Bullet lists
      i = processBulletList(lines, i, blocks);
    } else if (line.match(/^[\s]*\d+\.\s+(.+)$/)) {
      // Numbered lists
      i = processNumberedList(lines, i, blocks);
    } else {
      // Regular text
      i = processRegularText(lines, i, blocks);
    }
  }

  // Add interactive buttons if cb-actions were found
  if (cbActions && cbActions.suggestions && cbActions.suggestions.length > 0) {
    // Add divider before buttons
    blocks.push({
      type: "divider",
    });

    // Convert cb-actions to Slack buttons (max 5 buttons per actions block)
    const buttonElements = cbActions.suggestions.slice(0, 4).map((suggestion) => ({
      type: "button",
      text: {
        type: "plain_text",
        text: suggestion.label.substring(0, 75), // Button text limit is 75 chars
      },
      value: suggestion.label, // Send the label back as the user's response
      action_id: `quick_reply_${suggestion.id}`,
    }));

    // Add "Something else" button
    buttonElements.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Something else",
      },
      value: "something_else",
      action_id: "quick_reply_something_else",
      style: "primary",
    });

    blocks.push({
      type: "actions",
      elements: buttonElements,
    });
  }

  // Slack has a limit of 50 blocks per message
  if (blocks.length > 50) {
    const truncatedBlocks = blocks.slice(0, 49);
    truncatedBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_Response truncated. See full response in Chartbrew._",
      },
    });
    return truncatedBlocks;
  }

  return blocks.length > 0 ? blocks : null;
}

/**
 * Format AI orchestrator response for Slack using Block Kit
 * Returns an object with blocks and fallback text
 */
function formatResponse(message, snapshots = []) {
  if (!message) {
    return {
      text: "I couldn't generate a response. Please try again.",
      blocks: null,
    };
  }

  const blocks = parseMessageToBlocks(message);

  // Add snapshot images as blocks at the end
  if (snapshots && snapshots.length > 0) {
    snapshots.forEach((snapshot) => {
      if (snapshot.snapshot && typeof snapshot.snapshot === "string" && snapshot.snapshot.length > 0) {
        // Add image block
        // eslint-disable-next-line prefer-template
        const altText = ("Chart: " + (snapshot.chart_name || "Generated Chart")).substring(0, 200);
        blocks.push({
          type: "image",
          image_url: snapshot.snapshot,
          alt_text: altText,
        });
      }
    });
  }

  // Create fallback text (for notifications and accessibility)
  const fallbackText = message
    .replace(/```[\w]*\n([\s\S]*?)```/g, "[code]")
    .replace(/^#{1,3}\s+(.+)$/gm, "$1")
    .substring(0, 300);

  return {
    text: fallbackText,
    blocks,
  };
}

/**
 * Format error message for Slack using Block Kit
 */
function formatError(error) {
  const errorText = typeof error === "string"
    ? error
    : (error.message || "An error occurred");

  return {
    text: `❌ ${errorText}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `❌ ${errorText}`,
        },
      },
    ],
  };
}

module.exports = {
  markdownToSlackMrkdwn,
  parseMessageToBlocks,
  formatResponse,
  formatError,
};
