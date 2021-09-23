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
      let serviceAccount = connection.firebaseServiceAccount;
      try {
        serviceAccount = JSON.parse(connection.firebaseServiceAccount);
      } catch (e) {
        // do nothing
      }
      this.admin = firebase.initializeApp({
        credential: firebase.credential.cert(serviceAccount),
      }, firebaseAppName);
    }

    this.db = this.admin.firestore();
  }

  filter(docsRef, field, condition) {
    let newRef = docsRef;
    switch (condition.operator) {
      case "==":
        newRef = docsRef.where(field, "==", condition.value);
        break;
      case "!=":
        newRef = docsRef.where(field, "!=", condition.value);
        break;
      case "isNull":
        newRef = docsRef.where(field, "==", null);
        break;
      case "isNotNull":
        newRef = docsRef.where(field, "!=", null);
        break;
      case ">":
        newRef = docsRef.where(field, ">", condition.value);
        break;
      case ">=":
        newRef = docsRef.where(field, ">=", condition.value);
        break;
      case "<":
        newRef = docsRef.where(field, "<", condition.value);
        break;
      case "<=":
        newRef = docsRef.where(field, "<=", condition.value);
        break;
      case "array-contains":
        newRef = docsRef.where(field, "array-contains", condition.value);
        break;
      case "array-contains-any":
        newRef = docsRef.where(field, "array-contains-any", condition.values);
        break;
      case "in":
        newRef = docsRef.where(field, "in", condition.values);
        break;
      case "not-in":
        newRef = docsRef.where(field, "not-in", condition.values);
        break;
      default:
        break;
    }

    return newRef;
  }

  async get(dataRequest) {
    let docsRef = await this.db.collection(dataRequest.query);

    if (dataRequest.conditions) {
      dataRequest.conditions.forEach((c) => {
        const condition = c;
        if (condition.value === "true") condition.value = true;
        if (condition.value === "false") condition.value = false;

        const field = condition.field.replace("root[].", "");

        docsRef = this.filter(docsRef, field, condition);
      });
    }
    const formattedDocs = [];

    const docs = await docsRef.get();
    const subCollectionsPromises = [];
    docs.forEach(async (doc) => {
      if (dataRequest.configuration && dataRequest.configuration.subCollections) {
        subCollectionsPromises.push(doc.ref.listCollections());
      }
      formattedDocs.push({ ...doc.data(), _id: doc.id });
    });

    const subDataPromises = [];
    const subCollections = await Promise.all(subCollectionsPromises);
    subCollections.forEach((collections) => {
      collections.forEach((sub) => {
        subDataPromises.push(
          sub.get().then((snapshot) => {
            return { snapshot, parent: sub.parent.id, collection: sub.id };
          })
        );
      });
    });

    const subData = [];
    const subResults = await Promise.all(subDataPromises);
    subResults.forEach((sub) => {
      sub.snapshot.docs.forEach((d) => {
        subData.push({ ...d.data(), _parent: sub.parent, _collection: sub.collection });
      });
    });

    const nestedCheckedDocs = [];
    let index = -1;
    formattedDocs.forEach((data) => {
      const doc = data;

      // populate sub collections
      subData.forEach((sub) => {
        if (doc._id === sub._parent) {
          if (!doc[sub._collection]) doc[sub._collection] = [];
          doc[sub._collection].push(sub);
        }
      });

      nestedCheckedDocs.push({ ...doc });
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
