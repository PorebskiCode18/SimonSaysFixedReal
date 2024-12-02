// Import the functions you need from the SDKs you need
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";



import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

//will be unique for every project
const firebaseConfig = {
    apiKey: "AIzaSyDsBJRmWh1i1LYJmOgBdmAQcABpMoKzGjU",
    authDomain: "simon-says-6a629.firebaseapp.com",
    projectId: "simon-says-6a629",
    storageBucket: "simon-says-6a629.firebasestorage.app",
    messagingSenderId: "529660048703",
    appId: "1:529660048703:web:9ebb816290997b51a34f8a",
    measurementId: "G-13ZPSYS8ER"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);


// Initialize Firebase services
// const auth = getAuth(app); // Firebase Authentication
const db = getFirestore(app); // Firestore Database

export {db};