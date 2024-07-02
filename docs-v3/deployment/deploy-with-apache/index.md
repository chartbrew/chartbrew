---

canonicalUrl: https://docs.chartbrew.com/deployment/deploy-with-apache/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/deployment/deploy-with-apache/

---

# Serving on a domain with Apache

::: tip NOTE
Before starting, ensure you have built Chartbrew using the guide [Build and deploy](/deployment/).
:::

## Install Apache

As you already guessed, you will need Apache for this one. Below is guide on how to install it on Ubuntu 22.04:

* [Ubuntu 22.04](https://www.digitalocean.com/community/tutorials/how-to-install-the-apache-web-server-on-ubuntu-22-04)

Create a new Apache configuration file for the Chartbrew site.

```sh
sudo vim /etc/apache2/sites-available/chartbrew.conf
```

This configuration file will have everything necessary to serve the backend and frontend on your domains. Since both apps are already running on different ports, we will use a reverse proxy method to serve these on a domain.

```xml
# /etc/apache2/sites-available/chartbrew.conf

### FRONTEND
<VirtualHost *:80>
    # Important! use your own domain here
    ServerName  example.com  

    ProxyRequests off
    <Proxy *>
        Order deny,allow
        Allow from all
    </Proxy>
    <Location />
        ProxyPass http://localhost:4018/
        ProxyPassReverse http://localhost:4018/
    </Location>
    <Location ~ "/chart/*">
      Header always unset X-Frame-Options
    </Location>
    <Location ~ "/b/*">
      Header always unset X-Frame-Options
    </Location>
</VirtualHost>

### BACKEND
<VirtualHost *:80>
    # Important! use your own domain here
    ServerName  api.example.com

    ProxyRequests off
    <Proxy *>
        Order deny,allow
        Allow from all
    </Proxy>
    <Location />
        ProxyPass http://localhost:4019/
        ProxyPassReverse http://localhost:4019/
    </Location>
</VirtualHost>

```

Make sure you type your domain correctly and all the subdomains that you use are registered in your DNS configuration ([Cloudflare example](https://support.cloudflare.com/hc/en-us/articles/360019093151-Managing-DNS-records-in-Cloudflare)). Now activate the site and you will be able to access Chartbrew using your domain:

```sh
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2ensite chartbrew
sudo service apache2 reload
```

If you're making your site public, it's strongly recommended that you enable `https` on it. Some providers offer that automatically, but in case that's not happening have a look at [Certbot](https://certbot.eff.org/instructions) as it's super simple to set up and it's free.

### Troubleshooting the Chart Embedding feature

A problem that might arrise with embedding charts on other website is to do with the `X-Frame-Options` header being set as `deny` by the server. If your charts can't load on other sites because of this problem make sure you add the following configuration to the `VirtualHost` that serves your frontend:

```
<Location ~ "/chart/*">
  Header always unset X-Frame-Options
</Location>
```

This is already added in the example above, but if you create new virtual hosts for `https`, for example, don't forget to add it there as well.