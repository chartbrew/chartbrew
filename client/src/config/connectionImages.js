import mongoLogo from "../assets/mongodb-logo.png";
import firebaseLogo from "../assets/rd-light.webp";
import firestoreLogo from "../assets/firestore-light.webp";
import postgresLogo from "../assets/postgres.png";
import gAnalyticsLogo from "../assets/GoogleAnalytics.webp";
import mysqlLogo from "../assets/mysql.png";
import apiLogo from "../assets/api.png";
import plausibleLogo from "../assets/plausible-logo.png";
import customerioLogo from "../assets/customerio-light.webp";
import mongoDarkLogo from "../assets/mongodb-dark.png";
import firebaseDarkLogo from "../assets/rd-dark.webp";
import firestoreDarkLogo from "../assets/firestore-dark.webp";
import postgresDarkLogo from "../assets/postgres-dark.png";
import googleanalyticsDarkLogo from "../assets/googleanalytics-dark.png";
import mysqlDarkLogo from "../assets/mysql-dark.png";
import apiDarkLogo from "../assets/api-dark.png";
import plausibleDarkLogo from "../assets/plausible-dark.png";
import customerioDarkLogo from "../assets/customerio-dark.webp";
import timescaledbLogo from "../assets/timescale-light.webp";
import timescaledbDarkLogo from "../assets/timescale-dark.webp";
import simpleAnalyticsLogo from "../assets/simpleAnalytics.png";
import simpleAnalyticsDarkLogo from "../assets/simpleAnalytics-dark.png";
import mailgunLogo from "../assets/mailgun_logo.webp";
import mailgunDarkLogo from "../assets/mailgun-dark.png";
import chartMogulLogo from "../assets/ChartMogul.webp";
import chartMogulDarkLogo from "../assets/ChartMogul-dark.png";
import strapiLogo from "../assets/strapi-connection.webp";
import strapiDarkLogo from "../assets/Strapi-dark.png";
import stripeLogo from "../assets/stripe-connection.webp";
import stripeDarkLogo from "../assets/Stripe-dark.png";
import supabaseLogo from "../assets/supabase-connection.webp";
import supabaseDarkLogo from "../assets/Supabase-dark.png";
import rdsLogo from "../assets/rds.png";
import rdsDarkLogo from "../assets/rds-dark.png";

export default (isDark) => ({
  mongodb: isDark ? mongoDarkLogo : mongoLogo,
  firestore: isDark ? firestoreDarkLogo : firestoreLogo,
  realtimedb: isDark ? firebaseDarkLogo : firebaseLogo,
  postgres: isDark ? postgresDarkLogo : postgresLogo,
  api: isDark ? apiDarkLogo : apiLogo,
  mysql: isDark ? mysqlDarkLogo : mysqlLogo,
  googleAnalytics: isDark ? googleanalyticsDarkLogo : gAnalyticsLogo,
  plausible: isDark ? plausibleDarkLogo : plausibleLogo,
  customerio: isDark ? customerioDarkLogo : customerioLogo,
  timescaledb: isDark ? timescaledbDarkLogo : timescaledbLogo,
  simpleanalytics: isDark ? simpleAnalyticsDarkLogo : simpleAnalyticsLogo,
  mailgun: isDark ? mailgunDarkLogo : mailgunLogo,
  chartmogul: isDark ? chartMogulDarkLogo : chartMogulLogo,
  strapi: isDark ? strapiDarkLogo : strapiLogo,
  stripe: isDark ? stripeDarkLogo : stripeLogo,
  supabase: isDark ? supabaseDarkLogo : supabaseLogo,
  supabasedb: isDark ? supabaseDarkLogo : supabaseLogo,
  supabaseapi: isDark ? supabaseDarkLogo : supabaseLogo,
  rdsPostgres: isDark ? rdsDarkLogo : rdsLogo,
  rdsMysql: isDark ? rdsDarkLogo : rdsLogo,
});
