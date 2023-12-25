---

canonicalUrl: https://docs.chartbrew.com/database/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/database/

---

# Database configuration

## MySQL

You can install MySQL from multiple places. You can install it using Xampp, for example. [Download it from here >>](https://www.apachefriends.org/download.html)

After you download it, make sure the MySQL and Apache services are running in the console, then head over to [localhost/phpmyadmin](http://localhost/phpmyadmin) or [127.0.0.1/phpmyadmin](http://127.0.0.1/phpmyadmin) and create a new database using the UI.

## PostgreSQL

As an alternative to MySQL, Chartbrew now supports PostgreSQL. After you [download & install Postgres](https://www.enterprisedb.com/downloads/postgresql), you will have to create a new database that Chartbrew can use. You can create a new database using:

* [pgAdmin4](https://www.pgadmin.org/)
* [SQL language](https://www.postgresql.org/docs/current/sql-createdatabase.html)

## Environmental variables

The environmental variables below need to be set in the `.env` file in the root folder. If the file is not there, create it yourself and use the `.env-template` file as a guide.

```sh
### PRODUCTION

CB_DB_NAME= # Database name
CB_DB_USERNAME= # Database username
CB_DB_PASSWORD= # Database password
CB_DB_HOST= # Database host
CB_DB_PORT= # The port on which your database server runs
CB_DB_DIALECT= # 'mysql' or `postgres`
# If your database requires an SSL connection
CB_DB_CERT= # String format of the certificate 

### DEVELOPMENT

CB_DB_NAME_DEV= # Database name
CB_DB_USERNAME_DEV= # Database username
CB_DB_PASSWORD_DEV= # Database password
CB_DB_HOST_DEV= # Database host
CB_DB_PORT_DEV= # The port on which your database server runs
CB_DB_DIALECT_DEV= # 'mysql' or `postgres`
# If your database requires an SSL connection
CB_DB_CERT_DEV= # String format of the certificate 
```
