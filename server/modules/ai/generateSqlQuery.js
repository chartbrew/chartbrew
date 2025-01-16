const OpenAI = require("openai");

const openaiClient = new OpenAI({
  apiKey: process.env.NODE_ENV === "production" ? process.env.CB_OPENAI_API_KEY : process.env.CB_OPENAI_API_KEY_DEV,
});

async function generateSqlQuery(schema, question, conversationHistory = [], currentQuery = "") {
  const formattedSchema = JSON.stringify(schema).replace(/\\/g, "").replace(/"/g, "");

  try {
    const messages = [
      {
        role: "system",
        content: `
        You are an expert SQL query generator. Use the following database schema to generate an SQL query that matches the user's intent.
        The user might also provide a current query, which you should use to generate the final query but only if it's relevant.
        Database Schema:
        ${formattedSchema}

        Output the SQL query only.
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
      model: process.env.CB_OPENAI_MODEL || "gpt-4o-mini",
      messages,
    });

    const sqlQuery = response.choices[0].message.content;

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
      content: sqlQuery,
    });

    // remove the "```sql" and "```" from the beginning and end of the query
    const cleanedQuery = sqlQuery.replace(/^```sql\n|\n```$/g, "");

    return { query: cleanedQuery, conversationHistory };
  } catch (error) {
    return { query: "", conversationHistory };
  }
}

module.exports = {
  generateSqlQuery,
};
