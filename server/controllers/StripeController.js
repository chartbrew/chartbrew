const stripe = require("stripe");
const simplecrypt = require("simplecrypt");

const UserController = require("./UserController");
const TeamRole = require("../models/TeamRole");

const Chart = require("../models/Chart");
const Connection = require("../models/Connection");
const Project = require("../models/Project");
const User = require("../models/User");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

class StripeController {
  constructor() {
    this.stripe = stripe(settings.stripe.secret);
    this.user = new UserController();
    this.teamRole = TeamRole;
  }

  createCustomer(id) {
    let gCustomer;
    return this.user.findById(id)
      .then((user) => {
        // return the user if they already have a stripe ID
        if (user.stripeId) {
          return new Promise(resolve => resolve(user));
        }

        const { email } = user;
        return this.stripe.customers.create({
          description: `Customer for ${email}`,
          email,
        });
      })
      .then((customer) => {
        gCustomer = customer;
        return this.user.update(id, { stripeId: customer.id });
      })
      .then(() => {
        return new Promise(resolve => resolve(gCustomer));
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  getCustomer(customerId) {
    return this.stripe.customers.retrieve(customerId)
      .then((customer) => {
        return new Promise(resolve => resolve(customer));
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  createSource(customerId, source) {
    return this.stripe.customers.createSource(customerId, { source })
      .then((card) => {
        return new Promise(resolve => resolve(card));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  setDefaultSource(customerId, cardId) {
    return this.stripe.customers.update(
      customerId,
      { default_source: cardId },
    )
      .then((customer) => {
        return new Promise(resolve => resolve(customer));
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  removeSource(customerId, cardId) {
    return this.stripe.customers.deleteCard(customerId, cardId)
      .then((customer) => {
        return new Promise(resolve => resolve(customer));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  subscribeToPlan(userId, customerId, plan) {
    const planId = settings.stripe.plans[plan];
    let gSubscription;
    return this.stripe.subscriptions.create({
      customer: customerId,
      items: [
        { plan: planId },
      ],
    })
      .then((subscription) => {
        gSubscription = subscription;
        // update the user with a subscriptionID
        return this.user.update(userId, { subscriptionId: subscription.id });
      })
      .then(() => {
        return new Promise(resolve => resolve(gSubscription));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getSubscriptionDetails(subscriptionId) {
    return this.stripe.subscriptions.retrieve(subscriptionId)
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  updateSubscription(userId, subscriptionId, plan) {
    let gSub;
    let teamId;
    // first get the team details to see if the plan can be updated
    return this.teamRole.findOne({ where: { user_id: userId, role: "owner" } })
      .then((teamRole) => {
        if (!teamRole) throw new Error(400);
        teamId = teamRole.team_id;

        return this.canDowngradePlan(teamRole.team_id, plan);
      })
      .then(() => {
        return this.getSubscriptionDetails(subscriptionId);
      })
      .then((subscription) => {
        return this.stripe.subscriptions.update(
          subscriptionId,
          {
            cancel_at_period_end: false,
            items: [{
              id: subscription.items.data[0].id,
              plan: settings.stripe.plans[plan],
            }]
          }
        );
      })
      .then((subscription) => {
        gSub = subscription;
        // update the number of members subscription items
        return this.teamRole.findAll({ where: { team_id: teamId } });
      })
      .then((roles) => {
        const newPlan = settings.features[plan];
        let subscriptionItems;
        for (const sub of gSub.items.data) {
          if (sub.plan.nickname.toLowerCase() === "member") {
            subscriptionItems = sub.quantity;
          }
        }

        const newQuantity = roles.length - (subscriptionItems + newPlan.members);

        if (newQuantity > 0) {
          return this.updateMembers(subscriptionId, 0, newQuantity - subscriptionItems);
        } else if (newQuantity < 0) {
          return this.updateMembers(subscriptionId, 0, newQuantity + subscriptionItems);
        } else {
          return gSub;
        }
      })
      .catch((error) => {
        if (error.message && error.message.indexOf("No such subscription") > -1) {
          // make a new subscription
          return this.user.findById(userId);
        }
        return new Promise((resolve, reject) => reject(error));
      })
      .then((user) => {
        if (gSub && gSub.id) return new Promise(resolve => resolve(gSub));

        const customerId = sc.decrypt(user.stripeId);
        return this.subscribeToPlan(userId, customerId, plan);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  removeSubscription(subscriptionId) {
    // check if the user is allowed to remove the subscription
    return User.findOne({ where: { subscriptionId: sc.encrypt(subscriptionId) } })
      .then((user) => {
        return this.teamRole.findOne({ where: { user_id: user.id, role: "owner" } });
      })
      .then((teamRole) => {
        if (!teamRole) throw new Error(400);

        return this.canDowngradePlan(teamRole.team_id, "community");
      })
      .then(() => {
        // check if there are any members to be charged for and remove the quantity
        return this.updateMembers(subscriptionId, 0);
      })
      .then(() => {
        return this.stripe.subscriptions.del(subscriptionId, { at_period_end: true });
      })
      .then((confirmation) => {
        return new Promise(resolve => resolve(confirmation));
      })
      .catch((error) => {
        if (error.message === "404") {
          return this.stripe.subscriptions.del(subscriptionId);
        }
        return new Promise((resolve, reject) => reject(error));
      })
      .then((confirmation) => {
        return new Promise(resolve => resolve(confirmation));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  addMembers(subscriptionId) {
    const planId = settings.stripe.plans.member;
    return this.stripe.subscriptionItems.create({
      subscription: subscriptionId,
      plan: planId,
      quantity: 1,
    })
      .then((subscriptionItem) => {
        return new Promise(resolve => resolve(subscriptionItem));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  // member is either +1 or -1 to save writing similar code, 0 switch members to 0
  // newQuantity is used if the exact quantity of the member items is known
  updateMembers(subscriptionId, member, newQuantity) {
    const intMember = member ? parseInt(member, 10) : 0;
    return this.getSubscriptionDetails(subscriptionId)
      .then((subscription) => {
        // find the members subscription Item id
        let itemId;
        let quantity;
        for (const item of subscription.items.data) {
          if (item.plan.id === settings.stripe.plans.member) {
            itemId = item.id;
            quantity = item.quantity; // eslint-disable-line
            break;
          }
        }

        if (!itemId) throw new Error(404);

        // check if the number of members should be switched to 0
        let newMemberNumber = quantity + intMember;
        if (intMember === 0) newMemberNumber = 0;

        // if the newQuantity is specified, use that instead
        if (newQuantity && newQuantity > 0) newMemberNumber = newQuantity;

        if (newMemberNumber < 0) newMemberNumber = 0;
        return this.stripe.subscriptionItems.update(itemId, {
          quantity: newMemberNumber,
        });
      })
      .then((subscriptionItem) => {
        return new Promise(resolve => resolve(subscriptionItem));
      })
      .catch((error) => {
        if (error.message === "404" && intMember === 1) {
          return this.addMembers(subscriptionId);
        }

        return new Promise((resolve, reject) => reject(error));
      });
  }

  canDowngradePlan(teamId, newPlan) {
    const limitations = settings.features[newPlan];
    let gProjects;
    // check members
    return this.teamRole.findAll({ where: { team_id: teamId } })
      .then((roles) => {
        if (newPlan === "community" && roles.length > 1) {
          return new Promise((resolve, reject) => reject({ cbEntity: "member" }));
        }

        // check projects
        return Project.findAll({ where: { team_id: teamId } });
      })
      .then((projects) => {
        gProjects = projects;
        if (projects.length > limitations.projects) {
          return new Promise((resolve, reject) => reject({ cbEntity: "project" }));
        }

        // check connections
        const connectionPromises = [];
        for (const project of projects) {
          connectionPromises.push(Connection.findAll({ where: { project_id: project.id } }));
        }

        return Promise.all(connectionPromises);
      })
      .then((responses) => {
        for (const connections of responses) {
          if (connections.length > limitations.connections) {
            return new Promise((resolve, reject) =>
              reject({ cbEntity: "connection", projectId: connections[0].project_id }));
          }
        }

        // check the charts
        const chartPromises = [];
        for (const project of gProjects) {
          chartPromises.push(Chart.findAll({ where: { project_id: project.id } }));
        }

        return Promise.all(chartPromises);
      })
      .then((responses) => {
        for (const charts of responses) {
          if (charts && charts.length > limitations.charts) {
            return new Promise((resolve, reject) =>
              reject({ cbEntity: "chart", projectId: charts[0].project_id }));
          }
        }

        return new Promise(resolve => resolve({ canDowngrade: true }));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }
}

module.exports = StripeController;
