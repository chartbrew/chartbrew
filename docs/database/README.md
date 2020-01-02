# Database configuration

## MySQL

In order to successfully start the server-side app you need to have MySQL running on your machine. Create a new database that will be used by ChartBrew.

### Install MySQL and create a database

You can install MySQL from multiple places. You can install it using Xampp, for example. [Download it from here >>](https://www.apachefriends.org/download.html)

After you download it, make sure the MySQL and Apache services are running in the console, then head over to http://localhost/phpmyadmin and create a new database using the UI.

### Set up the environmental variables

The environmental variables below need to be set in the `.env` file in the root folder. If the file is not there, create it yourself and use the `.env-template` file as a guide.

```sh
### PRODUCTION

CB_DB_NAME= # Database name
CB_DB_USERNAME= # Database username
CB_DB_PASSWORD= # Database password
CB_DB_HOST= # Database host

### DEVELOPMENT

CB_DB_NAME_DEV= # Database name
CB_DB_USERNAME_DEV= # Database username
CB_DB_PASSWORD_DEV= # Database password
CB_DB_HOST_DEV= # Database host
```

## PostgreSQL

::: tip
Coming Soon!
:::
