const firebase = require("firebase-admin");
const determineType = require("../modules/determineType");

class FirestoreConnection {
  constructor(connection, dataRequestId) {
    const firebaseAppName = `${connection.name}_${connection.project_id}_${connection.id}_${dataRequestId}`;
    // first check if there is a firebase app already created for this dataset
    firebase.apps.forEach((firebaseApp) => {
      if (firebaseApp.name === firebaseAppName) {
        this.admin = firebaseApp;
      }
    });

    if (!this.admin) {
      this.admin = firebase.initializeApp({
        credential: firebase.credential.cert(connection.firebaseServiceAccount),
      }, firebaseAppName);
    }

    this.db = this.admin.firestore();

    // seed data
    // firestoreSeed(this.db, "client");
  }

  async get(dataRequest) {
    let docsRef = await this.db.collection(dataRequest.query);

    if (dataRequest.conditions) {
      dataRequest.conditions.forEach((c) => {
        const condition = c;
        if (condition.value === "true") condition.value = true;
        if (condition.value === "false") condition.value = false;

        const field = condition.field.replace("root[].", "");

        switch (condition.operator) {
          case "==":
            docsRef = docsRef.where(field, "==", condition.value);
            break;
          case "!=":
            docsRef = docsRef.where(field, "!=", condition.value);
            break;
          case "isNull":
            docsRef = docsRef.where(field, "==", null);
            break;
          case "isNotNull":
            docsRef = docsRef.where(field, "!=", null);
            break;
          case ">":
            docsRef = docsRef.where(field, ">", condition.value);
            break;
          case ">=":
            docsRef = docsRef.where(field, ">=", condition.value);
            break;
          case "<":
            docsRef = docsRef.where(field, "<", condition.value);
            break;
          case "<=":
            docsRef = docsRef.where(field, "<=", condition.value);
            break;
          case "array-contains":
            docsRef = docsRef.where(field, "array-contains", condition.value);
            break;
          case "array-contains-any":
            docsRef = docsRef.where(field, "array-contains-any", condition.values);
            break;
          case "in":
            docsRef = docsRef.where(field, "in", condition.values);
            break;
          case "not-in":
            docsRef = docsRef.where(field, "not-in", condition.values);
            break;
          default:
            break;
        }
      });
    }
    const formattedDocs = [];
    const docs = await docsRef.get();
    docs.forEach((doc) => {
      formattedDocs.push(doc.data());
    });

    const nestedCheckedDocs = [];
    let index = -1;
    formattedDocs.forEach((doc) => {
      nestedCheckedDocs.push(doc);
      index++;
      Object.keys(doc).forEach((key) => {
        if (determineType(doc[key]) === "array") {
          doc[key].forEach((subDoc, subIndex) => {
            if (determineType(subDoc) === "object") {
              if (subDoc._firestore) {
                nestedCheckedDocs[index][key][subIndex] = subDoc.id;
              } else {
                Object.keys(subDoc).forEach((subKey) => {
                  if (subDoc[subKey] && subDoc[subKey]._firestore) {
                    nestedCheckedDocs[index][key][subIndex][subKey] = subDoc[subKey].id;
                  }
                });
              }
            }
          });
        } else if (doc[key] && doc[key]._firestore) {
          nestedCheckedDocs[index][key] = doc[key].id;
        }
      });
    });

    return nestedCheckedDocs;
  }

  listCollections() {
    return this.db.listCollections();
  }
}

module.exports = FirestoreConnection;
