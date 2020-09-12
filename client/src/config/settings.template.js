export const API_HOST =
  process.env.NODE_ENV === "production"
    ? (process.env.REACT_APP_API_HOST || "https://api.chartbrew.com")
    : (process.env.REACT_APP_API_HOST_DEV || "http://localhost:3210");

export const SITE_HOST =
  process.env.NODE_ENV === "production"
    ? (process.env.REACT_APP_CLIENT_HOST || "https://chartbrew.com")
    : (process.env.REACT_APP_CLIENT_HOST_DEV || "http://localhost:3000");

export const DOCUMENTATION_HOST = process.env.NODE_ENV === "production" ? "https://docs.chartbrew.com" : "http://localhost:8080";

export const APP_VERSION = process.env.REACT_APP_VERSION;
export const ONE_ACCOUNT_ENABLED = !!process.env.REACT_APP_ONE_ACCOUNT_EXTERNAL_ID;
