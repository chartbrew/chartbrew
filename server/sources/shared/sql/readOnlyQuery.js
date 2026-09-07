const DANGEROUS_SQL_PATTERNS = [
  /\bdrop\b/i,
  /\bdelete\b/i,
  /\bupdate\b/i,
  /\binsert\b/i,
  /\btruncate\b/i,
  /\balter\b/i,
  /\bcreate\b/i,
  /\binto\b/i,
  // Block the whole PostgreSQL filesystem-access family in one pattern:
  // pg_read_file, pg_read_binary_file, pg_read_server_file(s), pg_stat_file,
  // pg_ls_dir, pg_ls_logdir, pg_ls_waldir, pg_ls_tmpdir,
  // pg_ls_archive_statusdir, pg_current_logfile, plus any future siblings.
  // The optional leading and trailing double-quote also covers the
  // quoted-identifier call form ("pg_read_file"(...)), which Postgres
  // accepts and which the per-function \bpg_read_file\b patterns missed.
  /(?:\b|")pg_(?:read|stat|ls|current_logfile)[a-z0-9_]*"?\s*\(/i,
  /(?:\b|")lo_export"?\s*\(/i,
  /(?:\b|")lo_import"?\s*\(/i,
  /\bcopy\b[\s\S]*\bto\s+program\b/i,
  /\binto\s+(out|dump)file\b/i,
  /\bload_file\s*\(/i,
  /\bload\s+data\b/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
  /\bexec(ute)?\b/i,
  /\bcall\b/i,
  /\bfile\s*\(/i,
  /\burl\s*\(/i,
];

function normalizeSqlQuery(query) {
  if (typeof query !== "string") {
    throw new Error("query must be a string");
  }

  let normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("query is required");
  }

  normalizedQuery = normalizedQuery.replace(/;\s*$/, "").trim();

  const upperQuery = normalizedQuery.toUpperCase();

  if (!upperQuery.startsWith("SELECT") && !upperQuery.startsWith("WITH")) {
    throw new Error("Only SELECT/WITH queries are allowed");
  }

  if (normalizedQuery.includes(";")) {
    throw new Error("Multi-statement queries are not allowed");
  }

  if (/--|\/\*|\*\//.test(normalizedQuery)) {
    throw new Error("SQL comments are not allowed in AI queries");
  }

  if (DANGEROUS_SQL_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
    throw new Error("Query contains blocked operations");
  }

  return normalizedQuery;
}

module.exports = { normalizeSqlQuery };
