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

      const databaseURL = connection.connectionString || `https://${serviceAccount.project_id}.firebaseio.com`;

      const authOptions = {
        credential: firebase.credential.cert(serviceAccount),
        databaseURL,
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

    return new Promise((resolve, reject) => {
      try {
        let ref = this.db.ref(dataRequest.route);
        if (configuration && configuration.orderBy === "child" && configuration.key) {
          ref = ref.orderByChild(configuration.key);
        } else if (configuration && configuration.orderBy === "key") {
          ref = ref.orderByKey();
        } else if (configuration && configuration.orderBy === "value") {
          ref = ref.orderByValue();
        }

        if (configuration && configuration.limitToLast && configuration.limitToLast !== "0") {
          ref = ref.limitToLast(parseInt(configuration.limitToLast, 10));
        }
        if (configuration && configuration.limitToFirst && configuration.limitToFirst !== "0") {
          ref = ref.limitToFirst(parseInt(configuration.limitToFirst, 10));
        }

        ref.on("value", (snapshot) => {
          let firebaseData = [];
          snapshot.forEach((dataPoint) => {
            firebaseData.push({ _key: dataPoint.key, ...dataPoint.val() });
          });

          if (determineType(firebaseData) !== "array") {
            firebaseData = [firebaseData];
          }

          return resolve(firebaseData);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}

module.exports = RealtimeDatabase;
