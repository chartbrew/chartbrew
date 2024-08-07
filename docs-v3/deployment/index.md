---

canonicalUrl: https://docs.chartbrew.com/deployment/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/deployment/

---

# Deploy Chartbrew on your server

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
- A database is created so that Chartbrew can use it (it must be empty if it wasn't used by Chartbrew before)
- `npm install` ran in the server folder or `npm run setup` in the project root folder
- Environmental variables are set for Production (check `.env-template` in the root folder to see which)

Once all these are checked, we can either run `npm run start`, or use an external tool like [`pm2`](https://pm2.keymetrics.io) to monitor and manage Node apps better.

```sh
npm install -g pm2

# starting the app in production
cd chartbrew/server
NODE_ENV=production pm2 start index.js --name "chartbrew-server"
```

You can also start [pm2 as a cluster](https://pm2.keymetrics.io/docs/usage/cluster-mode/) to take advantage of your server's multi-threading capabilities and 0-downtime reloads. If you wish to do this, replace the last command above with:

```sh
NODE_ENV=production pm2 start index.js --name "chartbrew-server" -i max
```

This will then run the server on the `port` specified in `server/settings.js`.

### Frontend

The Frontend app needs to be built and then served using [pm2](https://pm2.keymetrics.io) like above.

```sh
# build the app
cd chartbrew/client
npm run build
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
      script: "npm",
      interpreter: "none",
      args: "run preview"
    }
  ]
}
```

Now you can start the front-end app with `pm2 start app.config.json`

Using the methods above, the app can be accessed on localhost. To serve it on a domain, continue reading on.

## Run the application with Docker

::: warning WARNING
The setup is not yet updated for PostgreSQL. Please [open a PR](https://github.com/chartbrew/chartbrew/compare) or [a new issue](https://github.com/chartbrew/chartbrew/issues/new) if you have a solution or encounter any problems that can help us with the support.
:::

A [Chartbrew docker image](https://hub.docker.com/r/razvanilin/chartbrew) is built whenever a new version is released.

Before running the commands below, make sure you have a MySQL server already running and an empty database that Chartbrew can use. The database name should match the value of the `CB_DB_NAME` variable.

You will need a 32 bytes AES encryption key for the `CB_ENCRYPTION_KEY` variable. Run the following command to generate one:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```sh
docker pull razvanilin/chartbrew

docker run -p 4019:4019 -p 4018:4018 \
  -e CB_ENCRYPTION_KEY=your_32_bytes_key \
  -e CB_API_HOST=0.0.0.0 \
  -e CB_API_PORT=4019 \
  -e CB_DB_HOST=host.docker.internal \
  -e CB_DB_PORT=3306 \
  -e CB_DB_NAME=chartbrew \
  -e CB_DB_USERNAME=root \
  -e CB_DB_PASSWORD=password \
  -e CB_REDIS_HOST=host.docker.internal \
  -e CB_REDIS_PORT=6379 \
  -e CB_REDIS_PASSWORD=password \
  -e VITE_APP_CLIENT_HOST=http://localhost:4018 \
  -e VITE_APP_CLIENT_PORT=4018 \
  -e VITE_APP_API_HOST=http://localhost:4019 \
  razvanilin/chartbrew
```

### Changing environmental variables

If you change any of the `VITE_APP_*` variables after the first run, **it's important** to build the client application again from inside the image. This is done by running the following command:

```sh
# replace 'your_container_name' with the name of your docker container where Chartbrew is running

docker exec -it -w /code/client your_container_name npm run build
```

**Now let's analyse what is needed for the docker image to run properly**.

The `4019` port is used by the API and `4018` for the client app (UI). Feel free to map these to any other ports on your system (e.g `4523:4019`).

* `CB_ENCRYPTION_KEY` this string will be used to encrypt passwords and tokens. Use a secure 32 bytes string. [You can generate one here](/#generate-the-encryption-key).
* `CB_API_HOST` needs to point to the home address of the system. Usually for a docker image this is `0.0.0.0`.
* `CB_DB_HOST` is the host of your database and determines how the application can reach it. `host.docker.internal` is used when you want the container to connect to a service on your host such as a database running on your server already.
* `CB_DB_PORT` is the port number of your database.
* `CB_DB_NAME` the name of the database (make sure the database exists before running the image).
* `CB_DB_USERNAME` and `CB_DB_PASSWORD` are used for authentication with the DB.
* `CB_REDIS_HOST`, `CB_REDIS_PORT`, and `CB_REDIS_PASSWORD` are used for the Redis queue.
* `VITE_APP_CLIENT_HOST` is the address of the client application and is used by the client to be aware of its own address (not as important)
* `VITE_APP_CLIENT_PORT` The port number where your client application will run from.
* `VITE_APP_API_HOST` this is used for the client application to know where to make the API requests. This is the address of the API (backend).

If the setup fails in any way, please double-check that the environmental variables are set correctly. Check that both API and Client apps are running, and if you can't get it running, please [open a new issue](https://github.com/chartbrew/chartbrew/issues/new) with as much info as you can share (logs, vars).
