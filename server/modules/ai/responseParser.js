/**
 * AI Response Parser for Chartbrew
 *
 * Parses AI responses to extract structured information and progress events.
 * Enables real-time progress tracking and better user experience.
 */

/**
 * Infer event type from event text
 * @param {string} text - The event text
 * @returns {string} - The inferred event type
 */
function inferEventType(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("connect") || lowerText.includes("database") || lowerText.includes("connection")) {
    return "connection";
  }
  if (lowerText.includes("schema") || lowerText.includes("analyze") || lowerText.includes("structure")) {
    return "analysis";
  }
  if (lowerText.includes("query") || lowerText.includes("sql") || lowerText.includes("generate")) {
    return "query_generation";
  }
  if (lowerText.includes("execute") || lowerText.includes("run") || lowerText.includes("fetch")) {
    return "execution";
  }
  if (lowerText.includes("chart") || lowerText.includes("visual") || lowerText.includes("create")) {
    return "visualization";
  }
  if (lowerText.includes("summarize") || lowerText.includes("process")) {
    return "processing";
  }

  return "general";
}

/**
 * Create structured progress events for common AI orchestration steps
 */
const ProgressEvents = {
  // Connection phase
  CONNECTION_START: { type: "connection", message: "Connecting to database..." },
  CONNECTION_SUCCESS: { type: "connection", message: "Database connection established" },
  CONNECTION_ERROR: { type: "connection", message: "Failed to connect to database" },

  // Schema analysis phase
  SCHEMA_START: { type: "analysis", message: "Analyzing database schema..." },
  SCHEMA_SUCCESS: { type: "analysis", message: "Schema analysis completed" },
  SCHEMA_ERROR: { type: "analysis", message: "Failed to analyze schema" },

  // Query generation phase
  QUERY_START: { type: "query_generation", message: "Generating SQL query..." },
  QUERY_SUCCESS: { type: "query_generation", message: "Query generated successfully" },
  QUERY_ERROR: { type: "query_generation", message: "Failed to generate query" },

  // Query execution phase
  EXECUTION_START: { type: "execution", message: "Executing database query..." },
  EXECUTION_SUCCESS: { type: "execution", message: "Query executed successfully" },
  EXECUTION_ERROR: { type: "execution", message: "Query execution failed" },

  // Visualization phase
  CHART_START: { type: "visualization", message: "Creating chart..." },
  CHART_SUCCESS: { type: "visualization", message: "Chart created successfully" },
  CHART_ERROR: { type: "visualization", message: "Failed to create chart" },

  // General events
  PROCESSING_START: { type: "processing", message: "Processing request..." },
  PROCESSING_COMPLETE: { type: "processing", message: "Request completed successfully" },
  ERROR_OCCURRED: { type: "error", message: "An error occurred during processing" }
};

/**
 * Parse AI response for structured progress events
 * @param {string} response - The AI response text
 * @returns {Object} - Parsed response with events and cleaned text
 */
function parseProgressEvents(response) {
  const events = [];
  let cleanedResponse = response;

  // Look for progress markers in the response
  const progressPatterns = [
    // Tool usage patterns
    /\[PROGRESS:?\s*(.*?)\]/gi,
    /\[STATUS:?\s*(.*?)\]/gi,
    /\[STEP:?\s*(.*?)\]/gi,
    /\[ACTION:?\s*(.*?)\]/gi,

    // Common progress indicators
    /\b(looking|finding|searching|analyzing|generating|executing|creating|processing|connecting)\b.*?(\w+)/gi,
    /\b(started|beginning|finished|completed|done)\b.*?(\w+)/gi,
  ];

  // Extract events from response
  progressPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(response)) !== null) { // eslint-disable-line no-cond-assign
      const eventText = match[0].trim();
      const eventType = inferEventType(eventText);

      events.push({
        type: eventType,
        message: eventText,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Remove progress markers from the cleaned response
  cleanedResponse = response
    .replace(/\[PROGRESS:?\s*[^\]]*\]/gi, "")
    .replace(/\[STATUS:?\s*[^\]]*\]/gi, "")
    .replace(/\[STEP:?\s*[^\]]*\]/gi, "")
    .replace(/\[ACTION:?\s*[^\]]*\]/gi, "")
    .trim();

  return {
    events,
    cleanedResponse
  };
}

/**
 * Emit progress event via Socket.IO
 * @param {Object} socketManager - The socket manager instance
 * @param {string} conversationId - The conversation ID
 * @param {string|Object} event - The event type or event object
 * @param {Object} additionalData - Additional data to include
 */
function emitProgressEvent(socketManager, conversationId, event, additionalData = {}) {
  let eventData;

  if (typeof event === "string") {
    eventData = ProgressEvents[event] || { type: "general", message: event };
  } else {
    eventData = event;
  }

  socketManager.emitProgress(conversationId, eventData.type, {
    message: eventData.message,
    ...additionalData
  });
}

module.exports = {
  parseProgressEvents,
  ProgressEvents,
  emitProgressEvent,
  inferEventType
};
