export const API_HOST = process.env.NODE_ENV === "production" ? "https://api.chartbrew.com" : "http://localhost:3210";
export const DOCUMENTATION_HOST = process.env.NODE_ENV === "production" ? "https://docs.chartbrew.com" : "http://localhost:8080";
export const SITE_HOST = process.env.NODE_ENV === "production" ? "https://chartbrew.com" : "http://localhost:3000";
export const STRIPE_API_KEY = process.env.NODE_ENV === "production" ? "pk_live_Bx6iLZ5DaVqKTHLGdlbQiBYG" : "pk_test_uL2ZRZBMbr815XAbbVkkHBFl";
