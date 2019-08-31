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
git clone https://github.com/razvanilin/chartbrew.git
cd chartbrew
npm run setup
```

### Set up environmental variables

`touch server/.env`

Inspect `server/settings-dev.js` and `server/settings.js` to see what variables need to be set. You can place all these in the `.env` file or somewhere else to your liking.

Example of `settings-dev.js`:

```javascript
module.exports = {
  port: 3210,
  secret: process.env.CB_SECRET_DEV,
  client: "http://localhost:3000",
  api: "http://localhost:3210",
  adminMail: process.env.CB_ADMIN_MAIL,
  db: {
    dbName: process.env.CB_DB_NAME_DEV,
    dbUsername: process.env.CB_DB_USERNAME_DEV,
    dbPassword: process.env.CB_DB_PASSWORD_DEV,
    dbHost: process.env.CB_DB_HOST_DEV,
  },
  mailSettings: {
    host: process.env.CB_MAIL_HOST_DEV,
    port: 465,
    secure: true,
    auth: {
      user: process.env.CB_MAIL_USER_DEV,
      pass: process.env.CB_MAIL_PASS_DEV,
    },
  },
};
```

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
