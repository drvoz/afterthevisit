// Firebase configuration for the prototype.
//
// Leave apiKey empty to run in LOCAL mode (data saved in this browser only).
// To use Firebase: create a Firebase project, add a Web app, enable Cloud Firestore,
// and paste the values from Project settings → Your apps → SDK setup and configuration.
// You can also enter them at runtime on the "Data & setup" tab (stored in this browser).
//
// Note: Firebase web config values are identifiers, not secrets. Access is controlled
// by Firestore security rules (see firestore.rules). This prototype must only ever
// hold FICTIONAL data.

export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Firestore collection that holds care-plan documents.
export const COLLECTION = "carePlans";

// Firebase JS SDK version loaded from the Google CDN.
export const FIREBASE_SDK = "10.12.2";
