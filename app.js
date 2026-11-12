import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, WORKER_URL } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, serverTimestamp };

export async function getRole(u) {
  const s = await getDoc(doc(db, "users", u.uid));
  return s.exists() ? s.data().role : "student";
}
export function guard(required, cb) {
  onAuthStateChanged(auth, async (u) => {
    if (!u) return (location.href = "index.html");
    const r = await getRole(u);
    if (required === "admin" && r !== "admin") return (location.href = "estudante.html");
    cb(u, r);
  });
}
export async function list(name) {
  const s = await getDocs(query(collection(db, name), orderBy("createdAt", "desc")));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function upload(file, folder) {
  const t = await auth.currentUser.getIdToken();
  const r = await fetch(`${WORKER_URL}/upload?folder=${folder}&name=${encodeURIComponent(file.name)}`, {
    method: "PUT", headers: { Authorization: "Bearer " + t, "Content-Type": file.type }, body: file });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).url;
}
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
