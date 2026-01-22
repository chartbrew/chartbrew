async function summarize(payload) {
  const { question, result } = payload;

  // If no result provided, return a generic message
  if (!result) {
    return {
      text: "Query executed successfully. Use run_query to get specific results for summarization.",
    };
  }

  if (!global.openaiClient) {
    return {
      text: `Found ${result.rowCount} results`,
    };
  }

  // Use AI to generate a natural language summary
  const prompt = `Based on the question "${question}" and the following query results, provide a concise summary:\n\nResults: ${JSON.stringify(result.rows.slice(0, 5))}\nTotal rows: ${result.rowCount}`;

  try {
    const response = await global.openaiClient.chat.completions.create({
      model: global.openAiModel || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a data analyst. Provide concise summaries of query results." },
        { role: "user", content: prompt },
      ],
      max_tokens: 150,
    });

    return {
      text: response.choices[0].message.content,
    };
  } catch (error) {
    return {
      text: `Found ${result.rowCount} results`,
      notes: `AI summarization failed: ${error.message}`,
    };
  }
}

module.exports = summarize;
