import cookie from "react-cookies";

export function getAuthToken() {
  const token = cookie.load("brewToken");
  if (!token) {
    throw new Error("No Token");
  }
  return token;
}
