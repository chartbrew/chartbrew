<p align="center">
  <a href="https://chartbrew.com">
    <img src="https://docs.chartbrew.com/assets/cb_logo_4.png" alt="ChartBrew logo" width="250"/>
  </a>
</a>

<p align="center">
  <a href="https:/\/circleci.com/gh/razvanilin/chartbrew">
    <img src="https://circleci.com/gh/razvanilin/chartbrew.svg?style=svg" alt="ChartBrew build" />
  </a>
</p>

[ChartBrew](https://chartbrew.com) is an open-source web application used to generate charts from different data sources. The focus of this project is to make the process less tedious and put as much accent as possible on Usability.

This project was created by [Kate Belakova](https://github.com/belakova) and [Razvan Ilin](https://github.com/razvanilin)

📚 [**Read the full docs here**](https://docs.chartbrew.com)

🚙 [**Public roadmap over here**](https://trello.com/b/IQ7eiDqZ/chartbrew-roadmap)

💬 [**Join our Slack workspace**](https://join.slack.com/t/chartbrew/shared_invite/enQtNzMzMzkzMTQ5MDc0LTlhYTE0N2E4ZDE5Y2MyNTMxZGExNTVjYjZmN2FjZjlhMTdhZTBjMGQ5MGQwYjEzMjkzNzg0ZjE2MzEwMThlMjQ)

## Data sources

Currently, ChartBrew supports connections to these data sources.

* MySQL
* PostgreSQL
* MongoDB
* APIs that support JSON data

## Quickstart

### Prerequisites

* NodeJS v10.16.0+
* NPM
* MySQL v5+ Server running

### Setup

```sh
git clone git@github.com:razvanilin/chartbrew.git --branch v1.0.0-beta.1
cd chartbrew
npm run setup
```

You can remove `--branch <version>` from the git command if you want to checkout on `master`, although that main branch may not be stable at all times.

### Set up environmental variables

Inspect `server/settings-dev.js` and `server/settings.js` to see what variables need to be set. You can place all these in a `server/.env` file or somewhere else to your liking.

You can use `server/.env-template` as a guide to fill out the variables.

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
