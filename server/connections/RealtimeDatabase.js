const firebase = require("firebase-admin");

const determineType = require("../modules/determineType");

class RealtimeDatabase {
  constructor(connection, dataRequestId) {
    const firebaseAppName = `${connection.name}_${connection.project_id}_${connection.id}_${dataRequestId}`;
    // first check if there is a firebase app already created for this dataset
    firebase.apps.forEach((firebaseApp) => {
      if (firebaseApp.name === firebaseAppName) {
        this.admin = firebaseApp;
      }
    });

    if (!this.admin) {
      let serviceAccount = connection.firebaseServiceAccount;
      try {
        serviceAccount = JSON.parse(connection.firebaseServiceAccount);
      } catch (e) {
        // do nothing
      }

      const authOptions = {
        credential: firebase.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
      };

      if (connection.username) {
        authOptions.databaseAuthVariableOverride = {
          uid: connection.username,
        };
      }

      this.admin = firebase.initializeApp(authOptions, firebaseAppName);
    }

    this.db = this.admin.database();
  }

  getData(dataRequest) {
    const { configuration } = dataRequest;

    return new Promise((resolve) => {
      if (configuration && configuration.orderBy === "child" && configuration.key) {
        this.db.ref(dataRequest.route).orderByChild(configuration.key).on("value", (snapshot) => {
          let firebaseData = snapshot.val();
          if (determineType(firebaseData) !== "array") {
            firebaseData = [firebaseData];
          }

          return resolve(firebaseData);
        });
      } else if (configuration && configuration.orderBy === "key") {
        this.db.ref(dataRequest.route).orderByKey().on("value", (snapshot) => {
          let firebaseData = snapshot.val();
          if (determineType(firebaseData) !== "array") {
            firebaseData = [firebaseData];
          }

          return resolve(firebaseData);
        });
      } else if (configuration && configuration.orderBy === "value") {
        this.db.ref(dataRequest.route).orderByValue().on("value", (snapshot) => {
          let firebaseData = snapshot.val();
          if (determineType(firebaseData) !== "array") {
            firebaseData = [firebaseData];
          }

          return resolve(firebaseData);
        });
      } else {
        this.db.ref(dataRequest.route).once("value", (snapshot) => {
          let firebaseData = snapshot.val();
          if (determineType(firebaseData) !== "array") {
            firebaseData = [firebaseData];
          }

          return resolve(firebaseData);
        });
      }
    });
  }
}

module.exports = RealtimeDatabase;
