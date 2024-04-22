import cookie from "react-cookies";

export const tokenKey = "brewToken";

export function getAuthToken() {
  const token = cookie.load(tokenKey);
  // if (!token) {
  //   throw new Error("No Token");
  // }
  return token;
}

export function removeAuthToken() {
  cookie.remove(tokenKey, { path: "/" });
  return "done";
}
