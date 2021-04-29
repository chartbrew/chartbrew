const { google } = require("googleapis");

module.exports.getAuthToken = (connection) => {
  // Load the service account key JSON file.
  const serviceAccount = connection.firebaseServiceAccount;

  // Define the required scopes.
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/firebase.database"
  ];

  // Authenticate a JWT client with the service account.
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    scopes
  );

  // Use the JWT client to generate an access token.
  return jwtClient.authorize()
    .then((tokens) => {
      if (!tokens) {
        return new Promise((resolve, reject) => reject(new Error("Provided service account does not have permission to generate access tokens")));
      }

      const accessToken = tokens.access_token;
      return accessToken;
    })
    .catch((error) => {
      return Promise.reject(error);
    });
};
