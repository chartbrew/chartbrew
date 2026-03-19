const RUNTIME_SPECIAL_PARAMS = new Set([
  "token",
  "theme",
  "isSnapshot",
  "snapshot",
  "pass",
  "password",
  "accessToken",
]);

export function getAllSearchParams(searchParams) {
  const queryParams = {};

  if (!searchParams) {
    return queryParams;
  }

  searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  return queryParams;
}

export function getPublicChartRuntimeVariables(searchParams) {
  const variables = {};

  if (!searchParams) {
    return variables;
  }

  searchParams.forEach((value, key) => {
    if (!RUNTIME_SPECIAL_PARAMS.has(key)) {
      variables[key] = value;
    }
  });

  return variables;
}
