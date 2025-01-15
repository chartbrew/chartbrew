const OpenAI = require("openai");

const openaiClient = new OpenAI({
  apiKey: process.env.CB_OPENAI_API_KEY,
});

async function generateSqlQuery(schema, question) {
  const formattedSchema = JSON.stringify(schema).replace(/\\/g, "").replace(/"/g, "");

  try {
    const prompt = `
      You are an expert SQL query generator. Use the following database schema to generate an SQL query that matches the user's intent.
      Database Schema:
      ${formattedSchema}
      User's Intent:
      ${question}

      Output the SQL query only.
    `;

    const response = await openaiClient.chat.completions.create({
      model: process.env.CB_OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
    });

    const sqlQuery = response.choices[0].message.content;

    // remove the "```sql" and "```" from the beginning and end of the query
    const cleanedQuery = sqlQuery.replace(/^```sql\n|\n```$/g, "");

    return cleanedQuery;
  } catch (error) {
    return "";
  }
}

module.exports = {
  generateSqlQuery,
};
