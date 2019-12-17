# Database configuration

## MySQL

In order to successfully start the server-side app you need to have MySQL running on your machine. Create a new database that will be used by ChartBrew.

Additionally, the environmental variables below need to be set.

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

::: tip
The project uses `dotenv` meaning that you can also put your environmental variables in a `server/models/.env` and `server/models/.env` files.
:::

## PostgreSQL

::: tip
Coming Soon!
:::
