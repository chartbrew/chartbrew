export function oauthReturnPath(search) {
  const preview = new URLSearchParams(search).get("preview");
  if (/^[1-9]\d*$/.test(preview || "")) return `/previews/${preview}`;
  const id = new URLSearchParams(search).get("oauthRequest");
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id || "")
    ? `/oauth/consent?request=${id}` : "/";
}
