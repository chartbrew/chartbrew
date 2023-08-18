export const API_HOST = import.meta.env.PROD
  ? import.meta.env.REACT_APP_API_HOST
  : (import.meta.env.REACT_APP_API_HOST_DEV || "http://localhost:3210");

export const SITE_HOST = import.meta.env.PROD
  ? import.meta.env.REACT_APP_CLIENT_HOST
  : (import.meta.REACT_APP_CLIENT_HOST_DEV || "http://localhost:4018");

export const DOCUMENTATION_HOST = import.meta.PROD ? "https://docs.chartbrew.com" : "http://localhost:8080";

export const APP_VERSION = import.meta.env.REACT_APP_VERSION;
export const ONE_ACCOUNT_ENABLED = true;
export const SLACK_CLIENT_ID = import.meta.env.PROD ? import.meta.env.REACT_APP_SLACK_CLIENT_ID : import.meta.env.REACT_APP_SLACK_CLIENT_ID_DEV;
