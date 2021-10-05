const firebase = require("firebase-admin");
const determineType = require("../modules/determineType");

function populateReferences(docs, subData = []) {
  const nestedCheckedDocs = [];
  let index = -1;
  docs.forEach((data) => {
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

  async getSubCollections(dataRequest) {
    let docsRef = await this.db.collectionGroup(dataRequest.configuration.selectedSubCollection);

    if (dataRequest.conditions) {
      dataRequest.conditions.forEach((c) => {
        if (c.collection !== dataRequest.configuration.selectedSubCollection) return;
        const condition = c;
        if (condition.value === "true") condition.value = true;
        if (condition.value === "false") condition.value = false;

        const field = condition.field.replace("root[].", "");

        docsRef = this.filter(docsRef, field, condition);
      });
    }

    const finalData = [];
    const docs = await docsRef.get();
    docs.forEach((doc) => {
      finalData.push({ ...doc.data(), _id: doc.id, _parent: doc.ref.parent.parent.id });
    });

    return finalData;
  }

  async getSubCollectionsRefs(docs) {
    const subCollectionsPromises = [];
    docs.forEach((doc) => {
      subCollectionsPromises.push(doc.ref.listCollections());
    });

    const subCollections = await Promise.all(subCollectionsPromises);
    const collectionList = [];
    subCollections.forEach((subs) => {
      subs.forEach((sub) => {
        if (collectionList.indexOf(sub.id) === -1) {
          collectionList.push(sub.id);
        }
      });
    });

    return collectionList;
  }

  async getSubCollectionsData(docs) {
    const formattedDocs = [];
    const subCollectionsPromises = [];
    docs.forEach(async (doc) => {
      subCollectionsPromises.push(doc.ref.listCollections());
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

    return subData;
  }

  async get(dataRequest) {
    let docsRef = await this.db.collection(dataRequest.query);

    if (dataRequest.conditions) {
      dataRequest.conditions.forEach((c) => {
        if (c.collection && c.collection !== dataRequest.query) return;
        const condition = c;
        if (condition.value === "true") condition.value = true;
        if (condition.value === "false") condition.value = false;

        const field = condition.field.replace("root[].", "");

        docsRef = this.filter(docsRef, field, condition);
      });
    }
    const mainDocs = [];

    const docs = await docsRef.get();
    docs.forEach(async (doc) => {
      mainDocs.push({ ...doc.data(), _id: doc.id });
    });

    let subData = [];
    if (dataRequest.configuration && dataRequest.configuration.showSubCollections) {
      subData = await this.getSubCollectionsData(docs);
    }

    let subDocData = [];
    let finalDocs;
    if (dataRequest.configuration && dataRequest.configuration.selectedSubCollection) {
      subDocData = await this.getSubCollections(dataRequest);
      finalDocs = populateReferences(subDocData);
      // filter the docs based on what docs from the main collection are available
      finalDocs = finalDocs.filter((doc) => {
        if (mainDocs.filter((m) => m._id === doc._parent).length > 0) return true;
        return false;
      });
    } else {
      finalDocs = populateReferences(mainDocs, subData);
    }

    const subRefs = await this.getSubCollectionsRefs(docs);

    return {
      data: finalDocs,
      configuration: {
        subCollections: subRefs,
        mainCollectionSample: mainDocs.slice(0, 10),
        subCollectionSample: subDocData.slice(0, 10),
      },
    };
  }

  listCollections() {
    return this.db.listCollections();
  }
}

module.exports = FirestoreConnection;
