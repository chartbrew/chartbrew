<p align="center">
  <a href="https://chartbrew.com">
    <img src="https://chartbrew.com/logo_primary.svg" alt="ChartBrew logo" width="300"/>
  </a>
</a>

<br />

<p align="center">
  <a href="https://circleci.com/gh/chartbrew/chartbrew" target="_blank"><img src="https://circleci.com/gh/chartbrew/chartbrew.svg?style=svg" alt="ChartBrew build" /></a>
  <a href="https://discord.gg/KwGEbFk" target="_blank"><img src="https://img.shields.io/discord/656557151048957995?label=Discord" alt="" /></a>
</p>

<p align="center">
  <strong>
    <a href="https://chartbrew.com">Chartbrew</a> is an open-source web application that can connect directly to databases and APIs and use the data to create beautiful charts. It features a chart builder, editable dashboards, embedable charts, query & requests editor, and team capabilities.
  </strong>
</p>

<p align="center">
  <strong><a href="https://chartbrew.com">Chartbrew as a service is available here</a></strong>
</p>

<br />

<p align="center">
  <a href="https://chartbrew.com">
    <img src="https://chartbrew-static.b-cdn.net/banners/chartbrew-dashboard.png" alt="ChartBrew dashboard" width="600"/>
  </a>
</p>

<hr />

📚 [**Read the full docs here**](https://docs.chartbrew.com)

💡 [**Have any ideas or discussion topics?**](https://github.com/chartbrew/chartbrew/discussions)

💬 [**Join our Discord**](https://discord.gg/KwGEbFk)

## Data sources

[Check Chartbrew's website for the latest list of supported data sources](https://chartbrew.com)

## Prerequisites

* NodeJS v20
* MySQL (5+) or PostgreSQL (12.5+)
* Redis (v6+)

## Start

It is recommended you head over to the more detailed documentation to find out how to set up Chartbrew

[📚 You can find it here](https://docs.chartbrew.com/quickstart)

## Set up Chartbrew locally

### Create a new database

Chartbrew can run on MySQL or PostgreSQL. Create an empty database that Chartbrew can use.

### Clone and setup

```sh
git clone https://github.com/chartbrew/chartbrew.git
cd chartbrew && npm run setup
```

Complete the required environmental variables in `chartbrew/.env`. [Check out which need to be set here.](https://docs.chartbrew.com/quickstart#environmental-variables)

### Run the project in Development

Open two terminals, one for front-end and the other for back-end.

```sh
# frontend
cd client/
npm run start

# backend
cd server/
npm run start-dev
```

Head over to `http://localhost:4018` to see the app running and create your first user account.

## Deploy Chartbrew on Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://chartbrew.com/blog/how-to-deploy-chartbrew-on-render/)

## Deploy Chartbrew on Heroku and Vercel

[Read more on how to do this here](https://chartbrew.com/blog/how-to-deploy-chartbrew-on-heroku-and-vercel/)

## Run with Docker

[Check the full guide in the docs.](https://docs.chartbrew.com/deployment/run-on-docker)

### Quickstart

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

## Acknowledgements

Many thanks to [everybody that contributed](https://github.com/chartbrew/chartbrew/graphs/contributors) to this open-source project 🙏

[Start here if you want to become a contributor](https://github.com/chartbrew/chartbrew/blob/master/CONTRIBUTING.md)
