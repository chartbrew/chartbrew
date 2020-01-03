const simplecrypt = require("simplecrypt");

const StripeController = require("../controllers/StripeController");
const verifyToken = require("../modules/verifyToken");
const mail = require("../modules/mail");
const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (app) => {
  const stripeController = new StripeController();
  /*
  ** Route to create a new stripe customer
  */
  app.post("/stripe/customer", verifyToken, (req, res) => {
    return stripeController.createCustomer(req.user.id)
      .then((user) => {
        return res.status(200).send(user);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------

  /*
  ** Route to retrieve a stripe customer
  */
  app.get("/stripe/customer", verifyToken, (req, res) => {
    if (!req.user.stripeId) return res.status(404).send("Customer doesn't have a stripe customer ID");
    return stripeController.getCustomer(sc.decrypt(req.user.stripeId))
      .then((customer) => {
        return res.status(200).send(customer);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // --------------------------------------------------

  /*
  ** Route to add a payment method
  */
  app.post("/stripe/source", verifyToken, (req, res) => {
    if (!req.user.stripeId) {
      return stripeController.createCustomer(req.user.id)
        .then((customer) => {
          return stripeController.createSource(customer.id, req.body.source);
        })
        .then((source) => {
          return res.status(200).send(source);
        })
        .catch((error) => {
          return res.status(400).send(error);
        });
    } else {
      return stripeController.createSource(sc.decrypt(req.user.stripeId), req.body.source)
        .then((source) => {
          return res.status(200).send(source);
        })
        .catch((error) => {
          return res.status(400).send(error);
        });
    }
  });
  // --------------------------------------------------

  /*
  ** Route to set a payment method as default
  */
  app.put("/stripe/source/default", verifyToken, (req, res) => {
    return stripeController.setDefaultSource(sc.decrypt(req.user.stripeId), req.body.cardId)
      .then((customer) => {
        return res.status(200).send(customer);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------

  /*
  ** Route to remove a payment method
  */
  app.delete("/stripe/source", verifyToken, (req, res) => {
    return stripeController.removeSource(sc.decrypt(req.user.stripeId), req.body.cardId)
      .then((customer) => {
        return res.status(200).send(customer);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------

  /*
  ** Route to fetch a subscription
  */
  app.get("/stripe/subscription", verifyToken, (req, res) => {
    return stripeController.getSubscriptionDetails(sc.decrypt(req.user.subscriptionId))
      .then((subscription) => {
        return res.status(200).send(subscription);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });

  /*
  ** Route to subscribe to a plan
  */
  app.post("/stripe/subscription", verifyToken, (req, res) => {
    return stripeController.subscribeToPlan(
      req.user.id,
      sc.decrypt(req.user.stripeId),
      req.body.plan
    )
      .then((subscription) => {
        // send confirmation email
        mail.updateSubscription({
          plan: req.body.plan,
          email: req.user.email,
        });

        return res.status(200).send(subscription);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------

  /*
  ** Route to update a subscription
  */
  app.put("/stripe/subscription", verifyToken, (req, res) => {
    if (!req.user.stripeId) {
      return stripeController.createCustomer(req.user.id)
        .then((customer) => {
          return res.status(200).send(customer);
        })
        .catch((error) => {
          return res.status(400).send(error);
        });
    }

    if (!req.user.subscriptionId) {
      return stripeController.subscribeToPlan(
        req.user.id,
        sc.decrypt(req.user.stripeId),
        req.body.plan
      )
        .then((subscription) => {
          // send confirmation email
          mail.updateSubscription({
            plan: req.body.plan,
            email: req.user.email,
          });

          return res.status(200).send(subscription);
        })
        .then(() => {
        })
        .catch((error) => {
          if (error && error.code === "resource_missing") {
            return res.status(404).send(error);
          }
          return res.status(400).send(error);
        });
    }

    return stripeController.updateSubscription(
      req.user.id,
      sc.decrypt(req.user.subscriptionId),
      req.body.plan
    )
      .then((subscription) => {
        // send confirmation email
        mail.updateSubscription({
          plan: req.body.plan,
          email: req.user.email,
        });

        return res.status(200).send(subscription);
      })
      .catch((error) => {
        if (error.cbEntity) {
          return res.status(406).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------

  /*
  ** Route to remove a subscription
  */
  app.delete("/stripe/subscription", verifyToken, (req, res) => {
    return stripeController.removeSubscription(sc.decrypt(req.user.subscriptionId))
      .then((confirmation) => {
        // send email
        mail.endSubscription({
          email: req.user.email,
        });
        return res.status(200).send(confirmation);
      })
      .catch((error) => {
        if (error.cbEntity) {
          return res.status(406).send(error);
        }

        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------

  /*
  ** Route to add memebers
  */
  app.put("/stripe/subscription/members", verifyToken, (req, res) => {
    return stripeController.updateMembers(sc.decrypt(req.user.subscriptionId), req.body.member)
      .then((subscription) => {
        return res.status(200).send(subscription);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
