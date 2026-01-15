async function disambiguate(payload) {
  const { prompt, options } = payload;

  // This is a special tool that pauses execution and asks the user to choose
  // The orchestrator should handle this by returning a disambiguation request
  return {
    needs_user_input: true,
    prompt,
    options,
  };
}

module.exports = disambiguate;
