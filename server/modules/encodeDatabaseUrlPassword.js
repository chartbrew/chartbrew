module.exports = (uri) => {
  const start = uri.indexOf("://") + 3;
  const end = uri.lastIndexOf("@");
  const separator = uri.indexOf(":", start);
  if (separator < start || separator >= end) return uri;

  // Saved connection URLs can contain raw delimiters in the password.
  return uri.slice(0, separator + 1) + encodeURIComponent(uri.slice(separator + 1, end)) + uri.slice(end);
};
