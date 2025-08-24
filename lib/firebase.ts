
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyD4ExusrdQLnDO9ljSKQIQoRN_TNB9xggQ",
  authDomain: "thesisdp2.firebaseapp.com",
  projectId: "thesisdp2",
  storageBucket: "thesisdp2.firebasestorage.app",
  messagingSenderId: "21636702077",
  appId: "1:21636702077:web:bcfe20d005f494f7587614"
};

const app = initializeApp(firebaseConfig);

import { getFirestore } from "firebase/firestore";
export const db = getFirestore(app);