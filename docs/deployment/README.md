# Deploy ChartBrew on your server

::: tip INFO
With time, this guide will be updated with more ways of deploying. Any PR is welcome!
:::

## Building the app

Follow the [Getting Started](../#getting-started) guide to set up the project somewhere on your server.

Please note that you have to set all the production environmental variables in this case.

Keep in mind that the tools used in this guide are used as an example but they work really well. There might be multiple other tools that you can use, so feel free to do so if you wish.

## Serving the app

This guide is tried and tested with Ubuntu. The settings should be the same on all operating systems, but some of the files and commands may vary.

### Backend

The backend doesn't need to undergo a build process. You need the following things to make sure it can be served:

- MySQL running
- A database is created so that ChartBrew can use it (it must be empty if it wasn't used by ChartBrew before)
- `npm install` ran in the server folder or `npm run setup` in the project root folder
- Environmental variables are set for Production (check `server/settings.js` to see which)

Once all these are checked, we can either run `npm run start`, or use an external tool like [`pm2`](https://pm2.keymetrics.io) to monitor and manage Node apps better.

```sh
npm install -g pm2

# starting the app in production
cd chartbrew/server
NODE_ENV=production pm2 start index.js --name "chartbrew-server"
```

This will then run the server on the `port` specified in `server/settings.js`.

### Frontend

The Frontend app needs to be built and then server using [pm2](https://pm2.keymetrics.io) like above.

```sh
# build the app
cd chartbrew/client
mkdir dist && cd dist
vim build.sh
```

Copy the following in the `build.sh` file

```sh
cd ../ && npm run build && cp -rf build/* dist/
```

Create the `pm2` configuration file:

```sh
vim app.config.json
```

```js
{
  apps : [
    {
      name: "cbc-client",
      script: "npx",
      interpreter: "none",
      args: "serve -s . -p 5100"
    }
  ]
}
```

Now you can start the front-end app with `pm2 start app.config.json`

Using the methods above, the app can be accessed on localhost. To serve it on a domain, continue reading on.

## Serving on a domain with Apache

As you already guessed, you will need Apache for this one. Below is a list of guides I found on the Internet on how to install it on different systems:

* [Ubuntu 18.04](https://www.digitalocean.com/community/tutorials/how-to-install-the-apache-web-server-on-ubuntu-18-04)
* [Fedora 30/29/28](https://www.digitalocean.com/community/tutorials/how-to-install-the-apache-web-server-on-ubuntu-18-04)
* [Windows - using Xampp utility](https://www.apachefriends.org/download.html)
* [MacOS](https://tecadmin.net/install-apache-macos-homebrew/)

::: tip NOTE
This guide is made for Apache running on Ubuntu 16. It might be different on other operating systems and distros.
:::

Create a new Apache configuration file for the ChartBrew site.

```sh
sudo vim /etc/apache2/sites-available/chartbrew.conf
```

This configuration file will have everything necessary to serve the backend and frontend on your domains. Since both apps are already running on different ports, we will use a reverse proxy method to serve these on a domain.

**Replace all `http://0.0.0.0` with your actual server IP**

```xml
# /etc/apache2/sites-available/chartbrew.conf

# FRONTEND
<VirtualHost 0.0.0.0:80>
    ServerAdmin admin@example.com

    # Important! use your own domain here
    ServerName  example.com  

    # Index file and Document Root (where the public files are located)
    DocumentRoot /var/www/html/chartbrew/client/src/build

    ProxyRequests off
    <Proxy *>
        Order deny,allow
        Allow from all
    </Proxy>
    <Location />
        ProxyPass http://0.0.0.0:5400/
        ProxyPassReverse http://0.0.0.0:5400/
    </Location>
    <Location ~ "/chart/*">
      Header always unset X-Frame-Options
    </Location>
</VirtualHost>

# BACKEND
<VirtualHost 0.0.0.0:80>
    ServerAdmin admin@example.com

    # Important! use your own domain here
    ServerName  api.example.com

    # Index file and Document Root (where the public files are located)
    DocumentRoot /var/www/html/chartbrew/server

    ProxyRequests off
    <Proxy *>
        Order deny,allow
        Allow from all
    </Proxy>
    <Location />
        ProxyPass http://0.0.0.0:3210/
        ProxyPassReverse http://0.0.0.0:3210/
    </Location>

</VirtualHost>

```

Make sure you type your domain correctly and all the subdomains that you use are registered in your DNS configuration ([Cloudflare example](https://support.cloudflare.com/hc/en-us/articles/360019093151-Managing-DNS-records-in-Cloudflare)). Now activate the site and you will be able to access ChartBrew using your domain:

```sh
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
