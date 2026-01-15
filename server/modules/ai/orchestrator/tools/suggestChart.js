async function suggestChart(payload) {
  const {
    question, result_shape
  } = payload;
  // dialect and query could be used for context in the future

  if (!global.openaiClient) {
    return {
      type: "table",
      title: "Query Results",
      encodings: {},
      options: {},
    };
  }

  // Use AI to suggest appropriate chart type
  const prompt = `Based on the question "${question}" and result columns ${JSON.stringify(result_shape.columns)}, suggest the most appropriate Chartbrew chart type and configuration.

Available chart types: line, bar, pie, doughnut, radar, polar, table, kpi, avg, gauge.

Respond with JSON only: { "type": "...", "title": "...", "encodings": {}, "options": {} }`;

  try {
    const response = await global.openaiClient.chat.completions.create({
      model: global.openAiModel || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });

    const suggestion = JSON.parse(response.choices[0].message.content);
    return suggestion;
  } catch (error) {
    return {
      type: "table",
      title: "Query Results",
      encodings: {},
      options: {},
      notes: `Chart suggestion failed: ${error.message}`,
    };
  }
}

module.exports = suggestChart;
