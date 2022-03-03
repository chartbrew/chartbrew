---

canonicalUrl: https://docs.chartbrew.com/oneaccount/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/oneaccount/

---

# One account Docs

[One Account](https://oneaccount.app/) is a 3rd party authentication app that can be integrated in your Chartbrew project. **This setup is optional**, but can be useful for your organization and make signing up easier.

::: tip
  Before you proceed with the setup, ensure you deployed the app on your server. [Follow the deployment instructions here](/deployment)
:::

## Quick start

Download and install **One account** mobile app if you haven’t already.
- [Android ](https://play.google.com/store/apps/details?id=com.oila.oneaccount)
- [iOS ](https://apps.apple.com/de/app/one-account/id1428861716?l=en)

Click the “Sign in/up” button on the top right on [oneaccount.app ](https://oneaccount.app) and then use the mobile app to scan the QR code.

## Create a new app

Fill in the required fields:
  - App logo & App name
  - Callback URL - `{API_HOST}/oneaccountauth`
    - `API_HOST` is the address where you're hosting the Node app from `/server`
  - Requested data
    - Email (required)
    - First name (required)
    - Last name (required)

::: danger
  Make sure you choose the `email` field and TICK the `verified` and `required` checkboxes.
:::

::: tip
  Only request the data that's absolutely required. The less data you request the more users are likely to provide it. If you need extra data, make it `not required` so users can use your system even without providing some data. 
:::

**Save it** and copy the `externalId` value (press `Copy external id` button)

## App integration

Create a new file `/client/.env` and copy the following:

```sh
REACT_APP_ONE_ACCOUNT_EXTERNAL_ID=externalId
```

`externalId` is the value you copied above.

This will enable the `Sign in/up with One account` buttons on the login and signup pages. (unset `REACT_APP_ONE_ACCOUNT_EXTERNAL_ID` environment variable to disable the buttons).

**Important! The client app needs to be restarted/rebuilt if you change the `REACT_APP_ONE_ACCOUNT_EXTERNAL_ID` value**

Please read the official docs for **One account** should you have any issues: [docs.oneaccount.app ](https://docs.oneaccount.app).

Or reach out to **One account**'s support through the website: [oneaccount.app ](https://oneaccount.app).