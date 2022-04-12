---

canonicalUrl: https://docs.chartbrew.com/integrations/google-analytics/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/integrations/google-analytics/

---

# Google Analytics

The Google Analytics integration can be used once a new project is created and configured in Google Console.

## Setup

1. [Create a new project here](https://console.cloud.google.com/projectcreate)
2. Click on [**APIs and Services**](https://console.cloud.google.com/apis/dashboard) in the side menu
3. Click on [**Library**](https://console.cloud.google.com/apis/library) in the side menu and type **analytics** in the search bar
4. Click and enable both **Google Analytics Reporting API** and **Google Analytics API**
5. Head back to the [**APIs and Services**](https://console.cloud.google.com/apis/dashboard) page and click on [**OAuth Consent Screen**](https://console.cloud.google.com/apis/credentials/consent) option in the side menu
6. Select on either **Internal** or **External** depending on how you plan to use the integration
7. You will have to fill in all the required details in the form (no need for domain yet) then continue without filling anything on the rest of the tabs
8. Click on [**Credentials**](https://console.cloud.google.com/apis/credentials) in the side menu, click on **Create credentials**, and select **OAuth Client ID**
9. Select **Web application** from the dropdown list, enter any name, and in **Authorized redirect URIs** enter:
  * http://localhost:4018/google-auth (for local use)
  * https://example.com/google-auth (for production use with your domain)
10. You will get a Client ID and Client Secret which you will have to use for the **CB_GOOGLE_CLIENT_ID** and **CB_GOOGLE_CLIENT_SECRET** environmental variables
11. Head back to the [**OAuth Consent Screen**](https://console.cloud.google.com/apis/credentials/consent), scroll down the page, and add test users to enable certain google accounts to use the integration
12. (Optional) If you want to publish the Google app, you will have to click on the "Publish app" at the [top of the page](https://console.cloud.google.com/apis/credentials/consent).

## Usage

To learn how to use the Google Analytics integration, you can read [the tutorial on Chartbrew's blog](https://chartbrew.com/blog/create-your-google-analytics-dashboard-in-chartbrew/).