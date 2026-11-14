// shortcut: this covers known external function families; review it when adding ClickHouse version support.
const EXTERNAL_FUNCTIONS = [
  /^(file|url|s3|mysql|postgresql|sqlite|redis|mongodb|hdfs|jdbc|odbc|gcs|azureBlobStorage|hudi|hive|oss|cosn|paimon)(Cluster)?$/i,
  /^(remote(Secure)?|cluster(AllReplicas)?|executable(Pool)?)$/i,
  /^(iceberg(S3|Azure|HDFS|Local|Catalog)?|deltaLake(S3|Azure|Local)?)(Cluster)?$/i,
  /^(input|lakekeeper|unityCatalog|s3Queue|azureQueue)$/i,
];
const WRITE_KEYWORD = /^(?:insert|update|delete|drop|truncate|alter|create|attach|detach|rename|grant|revoke|into|kill|optimize|backup|restore)$/i;

function getQueryTokens(query) {
  const tokenPattern = /\s+|--[^\r\n]*|#[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:\\[\s\S]|''|[^'\\])*'|"(?:\\[\s\S]|""|[^"\\])*"|`(?:\\[\s\S]|``|[^`\\])*`|[a-zA-Z_][a-zA-Z_0-9]*|[\s\S]/gy;

  // Tokenize before checking names so comments cannot hide calls and literals stay unchanged.
  return Array.from(query.matchAll(tokenPattern), (match) => {
    const value = match[0];
    if (/^\s|^--|^#|^\/\*/.test(value)) return null;
    if (["'", "\"", "`"].includes(value)) {
      throw new Error("Query contains an unfinished quoted value");
    }
    if (value.startsWith("'")) {
      return { value, type: "string" };
    } else if (value.startsWith("\"") || value.startsWith("`")) {
      if (value.includes("\\")) {
        throw new Error("Escaped query identifiers are not supported");
      }
      return { value: value.slice(1, -1).replaceAll(value[0].repeat(2), value[0]), type: "identifier" };
    } else {
      return { value, type: "code", start: match.index };
    }
  }).filter(Boolean);
}

function normalizeClickhouseQuery(query) {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("ClickHouse query is required");
  }
  const tokens = getQueryTokens(query);
  if (tokens[0]?.type !== "code" || !/^(SELECT|WITH)$/i.test(tokens[0].value)) {
    throw new Error("Only SELECT/WITH queries are allowed");
  }

  tokens.forEach((token, index) => {
    if (token.type === "string") return;
    if (token.type === "code" && token.value === ";" && index !== tokens.length - 1) {
      throw new Error("Multi-statement queries are not allowed");
    }
    if ((token.type === "code" && WRITE_KEYWORD.test(token.value))
      || (/^(readonly|allow_ddl|allow_executable.*)$/i.test(token.value) && tokens[index + 1]?.value === "=")
      || (tokens[index + 1]?.value === "(" && EXTERNAL_FUNCTIONS.some((pattern) => pattern.test(token.value)))) {
      throw new Error("Query contains blocked operations");
    }
  });

  const lastToken = tokens[tokens.length - 1];
  if (lastToken.type === "code" && lastToken.value === ";") {
    return `${query.slice(0, lastToken.start)}${query.slice(lastToken.start + 1)}`.trim();
  }
  return query.trim();
}

module.exports = { normalizeClickhouseQuery };
