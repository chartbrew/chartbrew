const firebase = require("firebase-admin");

class FirestoreConnection {
  constructor(dataset) {
    const firebaseAppName = `${dataset.name}_${dataset.project_id}_${dataset.id}`;
    // first check if there is a firebase app already created for this dataset
    firebase.apps.forEach((firebaseApp) => {
      if (firebaseApp.name === firebaseAppName) {
        this.admin = firebaseApp;
      }
    });

    if (!this.admin) {
      this.admin = firebase.initializeApp({
        credential: firebase.credential.cert(dataset.firebaseServiceAccount),
      }, firebaseAppName);
    }

    this.db = this.admin.firestore();
  }

  get(collection) {
    return this.db.collection(collection).get();
  }

  listCollections() {
    return this.db.listCollections();
  }
}

module.exports = FirestoreConnection;
