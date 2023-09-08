import plausibleDash from "../containers/Connections/Plausible/plausible-template.jpeg";
import simpleanalyticsDash from "../containers/Connections/SimpleAnalytics/simpleanalytics-template.jpeg";
import chartmogulDash from "../containers/Connections/ChartMogul/chartmogul-template.jpeg";
import mailgunDash from "../containers/Connections/Mailgun/mailgun-template.jpeg";
import gaDash from "../containers/Connections/GoogleAnalytics/ga-template.jpeg";

export default [{
  type: "saTemplate",
  name: "Simple Analytics",
  image: simpleanalyticsDash,
}, {
  type: "cmTemplate",
  name: "ChartMogul",
  image: chartmogulDash,
}, {
  type: "mailgunTemplate",
  name: "Mailgun",
  image: mailgunDash,
}, {
  type: "googleAnalyticsTemplate",
  name: "Google Analytics",
  image: gaDash,
}, {
  type: "plausibleTemplate",
  name: "Plausible",
  image: plausibleDash,
}];
