const OpenAI = require("openai");

const openAiKey = process.env.NODE_ENV === "production" ? process.env.CB_OPENAI_API_KEY : process.env.CB_OPENAI_API_KEY_DEV;
const openAiModel = process.env.NODE_ENV === "production" ? process.env.CB_OPENAI_MODEL : process.env.CB_OPENAI_MODEL_DEV;
let openaiClient;

if (openAiKey) {
  openaiClient = new OpenAI({
    apiKey: openAiKey,
  });
}

async function generateClickhouseQuery(schema, question, conversationHistory = [], currentQuery = "") {
  if (!openaiClient) {
    throw new Error("OpenAI client is not initialized. Please check your environment variables.");
  }

  const formattedSchema = JSON.stringify(schema).replace(/\\/g, "").replace(/"/g, "");

  try {
    const messages = [
      {
        role: "system",
        content: `
        You are an expert ClickHouse query generator. Use the following database schema to generate a ClickHouse query that matches the user's intent.
        The user might also provide a current query, which you should use to generate the final query but only if it's relevant.
        Database Schema:
        ${formattedSchema}

        Output a valid ClickHouse query only, in the format: SELECT * FROM table LIMIT 10;
        Example: SELECT * FROM movies LIMIT 10;

        Try to format the query in a way that is easy to read and understand.

        If the user asks for a query with variables, you should use the variables in the query.
        Example: SELECT * FROM movies WHERE status = {{status}} LIMIT 10;

        Don't add variables if not specified by the user.
      `,
      },
      ...conversationHistory,
    ];

    messages.push({
      role: "user",
      content: question,
    });

    if (currentQuery) {
      messages.push({
        role: "user",
        content: `Current Query: ${currentQuery}`,
      });
    }

    const response = await openaiClient.chat.completions.create({
      model: openAiModel || "gpt-4o-mini",
      messages,
    });

    const clickhouseQuery = response.choices[0].message.content;

    conversationHistory.push({
      role: "user",
      content: question,
    });

    if (currentQuery) {
      conversationHistory.push({
        role: "system",
        content: `Current Query: ${currentQuery}`,
      });
    }

    conversationHistory.push({
      role: "assistant",
      content: clickhouseQuery,
    });

    // remove any markdown code blocks if present
    const cleanedQuery = clickhouseQuery.replace(/^```(\w+)?\n|\n```$/g, "");

    return { query: cleanedQuery, conversationHistory };
  } catch (error) {
    return { query: "", conversationHistory };
  }
}

module.exports = {
  generateClickhouseQuery,
};
