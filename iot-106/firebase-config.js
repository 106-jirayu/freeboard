export const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
  authDomain: "iot-106.firebaseapp.com",
  databaseURL: "https://iot-106-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iot-106",
  appId: "REPLACE_WITH_FIREBASE_APP_ID"
};

export const isFirebaseConfigured = !Object.values(firebaseConfig).some((value) => value.startsWith("REPLACE_WITH"));