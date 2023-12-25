---

canonicalUrl: https://docs.chartbrew.com/integrations/webhooks/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/integrations/webhooks/

---

# Webhooks

Currently webhooks are used by Chartbrew to send chart alerts.

## Webhook chart alerts

Chartbrew sends `POST` requests to the webhook URL with the following payload:

* `chart` - the chart name as a `string`
* `alert` - the alert configuration
  * `type` - the alert type is one of `milestone`, `threshold_above`, `threshold_below`, `threshold_between`, `threshold_outside`, `anomaly`
  * `rules` - this is an `object` that shows the trigger rules for the alert
* `alertsFound` - an `array` of `objects` containing a label and a value for each item on the chart that triggered the alert
* `dashboardUrl` - the URL to the dashboard where the chart is located

Example payload:

```json
{
  "chart": "Site stats",
  "alert": { "type": "milestone", "rules": { "value": "40" } },
  "alertsFound": [
    { "label": "2023 Jan 13", "value": 47 }
  ],
  "dashboardUrl": "https://app.chartbrew.com/project/1"
}
```