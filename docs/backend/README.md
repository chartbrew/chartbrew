---

canonicalUrl: https://docs.chartbrew.com/database/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/database/

---

# Chartbrew's backend

## Structure

```
|-- server
    |-- .eslintrc.json          # eslint configuration
    |-- .gitignore
    |-- index.js                # Server entry file
    |-- package-lock.json
    |-- package.json
    |-- settings-dev.js         # Global dev app settings
    |-- settings.js             # Global production app settings
    |-- api                     # All the routes are placed in this folder
    |   |-- UserRoute.js        # Example route for the /user
    |-- charts                  # Chart configurations
    |   |-- BarChart.js
    |   |-- LineChart.js
    |   |-- PieChart.js
    |-- controllers             # Controllers that interact directly with the models
    |   |-- UserController.js
    |-- models                  # All database-related files
    |   |-- config              # DB configration
    |   |   |-- config.js
    |   |-- models
    |   |   |-- User.js         # Example User model
    |   |-- migrations          # DB migration files
    |   |-- seeders             # If any data needs to be placed in the database
    |-- modules                 # Misc modules (AKA Services, Middlewares)
```

## How it works

Basically, a Model needs a Controller and if any data needs to be exposed through the API, then a Route is needed as well. The next part of the documentation will show a practical example on how to create a new model, controller, route and middleware.


## Models

Check out the [Sequelize documentation](https://sequelize.org/master/manual/models-definition.html) to find out all the possible options for a model.

To create a new model run the following command in `server/models`:

```sh
npx sequelize-cli model:generate --name Brew --attributes name:string
```

...where `Brew` is the model name and `name` is a string attribute.

**Important!** make sure that the generated migration contains all the fields created in the model.

Check the other models to learn how to create associations.

Code style used by the models:

```javascript
// any fields that define a relation will use snake_case
user_id: { // snake_case here
  type: Sequelize.INTEGER,
  allowNull: false,
  reference: {
    model: "Team",
    key: "id",
    onDelete: "cascade",
  },
},

// any other fields, camelCase
name: { // camelCase here
  type: Sequelize.STRING,
},
```

Now let's see how a new model can be integrated with the app. In the example below we will create a `Brew` model.

```javascript
module.exports = (sequelize, DataTypes) => {
  const Brew = sequelize.define("Brew", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    },
    name: {
      type: DataTypes.STRING,
    },
    flavour: {
      type: DataTypes.String,
      defaultValue: "Charty",
    },
  }, {
    freezeTableName: true, // ! important to set this !
  });

  Brew.associate = (models) => {
    // example association when a brew has multiple ingredients
    // the 'Ingredient' model has a foreign key names 'brew_id'
    models.Brew.hasMany(models.Ingredients, { foreignKey: "brew_id" });
  };

  return Brew;
};
```

## Controllers

The controllers hold all the functions that the app needs to manipulate the data with Sequelize (or any other functionality that uses data from the database). If the functions are not using any data from the database, consider using [Middleware](#middleware) or [Modules](#modules).

Controllers code-style and `Brew` example below:

```javascript
const db = require("../models/models");

class BrewController { // The name of the controllers should always be <Model>Controller
  findById(id) { // standard function name when retrieving one item
    return db.Brew.findByPk(id) // always using promises (no callbacks, async/await acceptable)
      .then((foundBrew) => {
        if (!foundBrew) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }

        return foundBrew;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error.message || error));
      });
  }
}
```

## Routes

Like the models, all the routes need to be registered in `api/index.js` file in order for the application to see them.

Below is an example of a brew route that uses the controller created above with some explanations about the code style guide.

```javascript
const BrewController = require("../controllers/BrewController");

module.exports = (app) => {
  const brewController = new BrewController(); // initialise the controller in a camelCase variable

  /*
  ** This is a mandatory explanation of the route.
  ** This route will return a single brew by ID
  */
  app.get("/brew/:id", (req, res) => {
    return brewController.findById(req.params.id) // promises (desirable) or async/await
      .then((foundBrew) => {
        return res.status(200).send(foundBrew);
      })
      .catch((error) => { // needs a better error management strategy, but this is how it's done atm
        if (error.message === "404") {
          return res.status(404).send({ error: "not found" });
        }

        return res.status(400).send({ error });
      });
  });
  // ------------------------------------------

  // this modules needs to return a middleware
  return (req, res, next) => {
    next();
  };
};
```

The next step is to register the new route with the `index` file:

```javascript
const brew = require("../BrewRoute");
// ---

module.exports = {
  brew,
  // ---
};
```

## Authentication

Chartbrew uses [jwt](https://jwt.io) token authentication.

To make authenticated requests, the `Authorization` header must be set to include a valid token

```
Authorization: Bearer <token>
```

Making a POST to `/user/login` with a valid `email` and `password` will return the token in the response.

In order to add authorization checks to the routes, the `verifyToken` middleware can be used in the routes like so:

```javascript
const verifyToken = require("../modules/verifyToken");
// -------

app.get("/brew/:id", verifyToken, (req, res) => {
  // ---
});
// ---
```

### Permissions & Roles

Chartbrew implements permissions and roles as well, but in not-so-ideal way. A future update will try a remedy this in a way to make it easier to make changes to these.

All the permissions and roles are registered in `modules/accessControl.js`. It is important to note that most of these roles are from the team perspective. So for example if a chart `"read:any"` permission is given to a user, this user can read `any` charts from the `team` that user is in **only**.

Below you can see an example on how to protect resources based on permissions and roles.

```javascript
// create a chart example
app.post("/project/:project_id/chart", verifyToken, (req, res) => {
  return projectController.findById(req.params.project_id)
    .then((project) => {
      // get the team role for the user that is making the request
      // "req.user" is populated by the "verifyToken" middleware
      return teamController.getTeamRole(project.team_id, req.user.id);
    })
    .then((teamRole) => {
      // if the user can update any charts in the team, proceed with the request
      const permission = accessControl.can(teamRole.role).updateAny("chart");
      if (!permission.granted) {
        throw new Error(401);
      }
    }
    // ---
  });
  // ---
});
```

## Middleware

The middleware can be used in the all the routes in the `api` folder. Have a look at the [ExpressJS documentation on Middleware](https://expressjs.com/en/guide/using-middleware.html) for more details.

## Modules

This folder contains various functionality that usually doesn't use local database data. The middleware will be moved from here in due course.
