---

canonicalUrl: https://docs.chartbrew.com/integrations/webhooks/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/integrations/webhooks/

---

# Webhooks

Webhooks are used by Chartbrew to send chart alerts. Chartbrew also supports sending data to Slack through the [Incoming Webhook integration](https://api.slack.com/messaging/webhooks).

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
  "dashboardUrl": "https://app.chartbrew.com/project/1",
  "snapshotUrl": "https://api.chartbrew.com/uploads/1234567890.png"
}
```

## Slack webhook

When sending data to Slack, Chartbrew will also attach a `blocks` property to the payload. This is an array of `objects` that contain the [Slack blocks](https://api.slack.com/block-kit) to be rendered in the message.
