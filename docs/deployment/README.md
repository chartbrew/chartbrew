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

- [ ] MySQL running
- [ ] A database is created so that ChartBrew can use it (it must be empty if it wasn't used by ChartBrew before)
- [ ] `npm install` ran in the server folder or `npm run setup` in the project root folder
- [ ] Environmental variables are set for Production (check `server/settings.js` to see which)

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
npm run build

# serve the build
# export PM2_SERVE_PORT=5400 --> this is needed if you want to change pm2's default 8080 port
pm2 serve build/ --name "chartbrew-client"
```

Using the methods above, the app can be accessed on localhost. To serve it on a domain, continue reading on.

## Serving with Apache

As you already guessed, you will need Apache for this one. Below is a list of guides I found on the Internet on how to install it on different systems:

* [Ubuntu 18.04](https://www.digitalocean.com/community/tutorials/how-to-install-the-apache-web-server-on-ubuntu-18-04)
* [Fedora 30/29/28](https://www.digitalocean.com/community/tutorials/how-to-install-the-apache-web-server-on-ubuntu-18-04)
* [Windows - using Xampp utility](https://www.apachefriends.org/download.html)
* [MacOS](https://tecadmin.net/install-apache-macos-homebrew/)
