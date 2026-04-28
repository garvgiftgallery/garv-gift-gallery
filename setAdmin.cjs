const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// 1. Initialize the Secure Connection
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🚨 2. PASTE YOUR FIREBASE AUTH UID HERE
const YOUR_ACCOUNT_UID = "cQHacT8mY1TL5AVXvSuJDL3e7yM2";

// 3. Mint the Admin Badge (Custom Claim)
admin.auth().setCustomUserClaims(YOUR_ACCOUNT_UID, { admin: true })
  .then(() => {
    console.log(`✅ SUCCESS! Admin badge securely minted for UID: ${YOUR_ACCOUNT_UID}`);
    console.log(`Please log out and log back into your web app to refresh your token.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ ERROR setting admin claim:", error);
    process.exit(1);
  });
