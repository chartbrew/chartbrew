const firebase = require("firebase-admin");

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
  }

  async get(collection) {
    const docs = await this.db.collection(collection).get();
    const formattedDocs = [];
    docs.forEach((doc) => {
      formattedDocs.push(doc.data());
    });

    return formattedDocs;
  }

  listCollections() {
    return this.db.listCollections();
  }
}

module.exports = FirestoreConnection;
