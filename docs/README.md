# ChartBrew Docs

## Prerequisites

**NodeJS** v10.16.0+

**NPM**

**MySQL** v5+ Server running

## Getting Started

### Installation & Setup

```sh
npm install -g create-chartbrew-app
create-chartbrew-app myApp --dbname="chartbrew" --dbusername="root" --dbpassword="" --dbhost="localhost"
```

The arguments are optional, but they set the environmental variables needed for the project to run. Check the section below to see what needs to be set.

### Set up environmental variables

Inspect `server/settings-dev.js` and `server/settings.js` to see what variables need to be set. You can place all these in a `server/.env` file or somewhere else to your liking.

You can use `server/.env-template` as a guide to fill out the variables.

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

### Setting up the frontend settings

Modify the constants to match your environment.

`API_HOST` - where your API is running

`DOCUMENTATION_HOST` - in case you're running the documentation somewhere on your server (you can also leave it to the live ChartBrew one)

`SITE_HOST` - this is where your frontend is sitting

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

### Changing the docs

ChartBrew uses [Vuepress](https://vuepress.vuejs.org/) and you can check their documentation to see how it works. You can start the documentation development using the command below:

```sh
cd chartbrew
npm run docs:dev
```

## Tech stack

**Backend**

* [NodeJS](https://nodejs.org/en/)
* [ExpressJS](https://expressjs.com/)
* [Sequelize ORM](https://sequelize.org/)
* [Nodemailer](https://nodemailer.com/about/)
* [Mongoose](https://mongoosejs.com/) for mongoDB data sources

**Frontend**

* [ReactJS](https://reactjs.org/)
* [Redux](https://redux.js.org/)
* [Semantic UI](https://fomantic-ui.com/) (Fomantic UI at the moment)
* [ChartJs](https://www.chartjs.org/)

**Docs**

* [Vuepress](https://vuepress.vuejs.org/)
