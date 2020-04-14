# One account Docs

## Quick start

#### Download and install **One account** mobile app if you haven’t already.
- [Android ](https://play.google.com/store/apps/details?id=com.oila.oneaccount)
- [iOS ](https://apps.apple.com/de/app/one-account/id1428861716?l=en)

#### Use the application to scan the QR code and login into **One account**: Click the “Sign in/up” button on the top right on [oneaccount.app ](https://oneaccount.app).

#### Create a new app.

- Fill in the required fields:
  - App logo
  - App name
  - Callback URL (set to `{API_HOST}/user/oneaccount-callback`, replace `API_HOST` with your host)
  - Requested data: (Select the data you want to request from your users authenticating through **One account**)

::: danger
  Make sure you choose the `email` field and TICK the `verified` and `required` checkboxes.
:::

::: tip
  Only request the data that's absolutely required. The less data you request the more users are likely to provide it. If you need extra data, make it `not required` so users can use your system even without providing some data. 
:::

#### Save it and press on the integrate button.

#### Copy the `externalId`.

Set `REACT_APP_ONE_ACCOUNT_EXTERNAL_ID` environment variable to the `externalId` you just copied.

This will enable the `Sign in/up with One account` buttons on the login and signup pages. (unset `REACT_APP_ONE_ACCOUNT_EXTERNAL_ID` environment variable to disable the buttons).

#### Restart the client with the environment variable set.

Please read the official docs for **One account** should you have any issues: [docs.oneaccount.app ](https://docs.oneaccount.app).

Or reach out to **One account**'s support through the website: [oneaccount.app ](https://oneaccount.app).