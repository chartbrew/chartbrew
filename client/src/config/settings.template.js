export const API_HOST = import.meta.env.PROD
  ? import.meta.env.VITE_APP_API_HOST
  : (import.meta.env.VITE_APP_API_HOST_DEV || "http://localhost:4019");

export const SITE_HOST = import.meta.env.PROD
  ? import.meta.env.VITE_APP_CLIENT_HOST
  : (import.meta.env.VITE_APP_CLIENT_HOST_DEV || "http://localhost:4018");

export const DOCUMENTATION_HOST = import.meta.env.PROD ? "https://docs.chartbrew.com" : "http://localhost:8080";

export const APP_VERSION = import.meta.env.VITE_APP_VERSION;
export const ONE_ACCOUNT_ENABLED = !!import.meta.env.VITE_APP_ONE_ACCOUNT_EXTERNAL_ID;
