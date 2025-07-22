// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider,
  onAuthStateChanged, signInWithPopup,
  signInAnonymously, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc,
  addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
  limit, startAfter, getDocs, onSnapshot,
  arrayUnion, arrayRemove, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Initialize
const firebaseConfig = {
  apiKey: "AIzaSyCAVF_QueVUEGojKuB3vKH8L39wMZocJ24",
  authDomain: "ishwar0980-7525b.firebaseapp.com",
  projectId: "ishwar0980-7525b",
  storageBucket: "ishwar0980-7525b.appspot.com",
  messagingSenderId: "522376702284",
  appId: "1:522376702284:web:433b482f1196c9c23d87e9"
};

const OWNER_UID = "LMRHGwdCUeRRJRQnOyPNFwDMtK92";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const gp = new GoogleAuthProvider();

// DOM Refs
const loginBtn = document.getElementById("login-main-btn");
const registerBtn = document.getElementById("register-main-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const newCommentEl = document.getElementById("new-comment");
const postCommentBtn = document.getElementById("post-comment-btn");
const commentsDiv = document.getElementById("comments");
const loadMoreBtn = document.getElementById("load-more-btn");

// Modal Function
const openModal = id => document.getElementById(id).classList.remove("hidden");

// Auth UI setup
loginBtn.onclick = () => openModal("login-modal");
registerBtn.onclick = () => openModal("register-modal");
logoutBtn.onclick = () => signOut(auth);

// Login handlers
document.getElementById("login-email-btn").onclick = () =>
  signInWithEmailAndPassword(auth,
    document.getElementById("login-email").value,
    document.getElementById("login-pass").value
  ).catch(e => alert(e.message));

document.getElementById("login-google-btn").onclick = () =>
  signInWithPopup(auth, gp).catch(e => alert(e.message));

// Register handlers
document.getElementById("register-email-btn").onclick = () =>
  createUserWithEmailAndPassword(auth,
    document.getElementById("reg-email").value,
    document.getElementById("reg-pass").value
  ).catch(e => alert(e.message));

document.getElementById("register-google-btn").onclick = () =>
  signInWithPopup(auth, gp).catch(e => alert(e.message));

document.getElementById("register-guest-btn").onclick = () =>
  signInAnonymously(auth).catch(e => alert(e.message));

// State & Pagination
let currentUser = null, lastVisible = null;
const PAGE_SIZE = 10;

// Auth State Listener
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    userInfo.textContent = `Hello, ${user.displayName || "Guest"}`;
    document.querySelectorAll(".auth-show").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".auth-hide").forEach(el => el.classList.remove("hidden"));
    closeModal("login-modal");
    closeModal("register-modal");
  } else {
    userInfo.textContent = "Not signed in";
    document.querySelectorAll(".auth-show").forEach(el => el.classList.remove("hidden"));
    document.querySelectorAll(".auth-hide").forEach(el => el.classList.add("hidden"));
  }
});

// Utility: time ago
function timeAgo(ts) {
  const now = Date.now(), secs = Math.floor((now - ts.toMillis()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Post Comment
postCommentBtn.onclick = async () => {
  if (!currentUser) return alert("Please login first");
  const txt = newCommentEl.value.trim();
  if (!txt) return;
  await addDoc(collection(db, "comments"), {
    text: txt,
    uid: currentUser.uid,
    name: currentUser.displayName || "Guest",
    created: serverTimestamp(),
    edited: false,
    likes: [], dislikes: []
  });
  newCommentEl.value = "";
  loadComments(true);
};

async function loadReplies(parentId, container, reset = false) {
  if (reset) container.innerHTML = "";
  const snap = await getDocs(query(collection(db, "comments", parentId, "replies"), orderBy("created", "asc")));
  const replies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  replies.slice(0, 5).forEach(r => renderReply(r, container));
  if (replies.length > 5) {
    const btn = document.createElement("button");
    btn.textContent = `Show ${replies.length - 5} more replies`;
    btn.className = "text-sm text-blue-500 ml-6";
    btn.onclick = () => {
      replies.slice(5).forEach(r => renderReply(r, container));
      btn.remove();
    };
    container.appendChild(btn);
  }
}

function renderReply({ id, name, text, created, photoURL, uid }, container) {
  const isAdmin = uid === OWNER_UID;
  const avatar = photoURL || '/default-avatar.png';
  const el = document.createElement("div");
  el.className = "bg-gray-50 p-2 rounded mb-1 flex items-start gap-2";
  el.innerHTML = `
    <img src="${avatar}" class="w-6 h-6 rounded-full ${isAdmin ? 'ring-2 ring-yellow-400' : ''}" alt="${name}" />
    <div class="flex-1">
      <div class="flex justify-between">
        <p class="text-sm font-semibold ${isAdmin ? 'text-yellow-600' : ''}">
          ${name}${isAdmin ? ' ★' : ''}
        </p>
        <p class="text-xs text-gray-500">${created ? timeAgo(created) : ''}</p>
      </div>
      <p class="text-sm ml-1">${text}</p>
    </div>`;
  container.appendChild(el);
}


// Load & Render Comments
async function loadComments(reset = false) {
  if (reset) { commentsDiv.innerHTML = ""; lastVisible = null; }
  let q = query(collection(db, "comments"), orderBy("created", "desc"), limit(PAGE_SIZE));
  if (lastVisible) q = query(q, startAfter(lastVisible));
  const snap = await getDocs(q);
  loadMoreBtn.classList.toggle("hidden", snap.size < PAGE_SIZE);
  lastVisible = snap.docs[snap.docs.length - 1];
  snap.forEach(d => renderComment(d.id, d.data()));
}
loadMoreBtn.onclick = () => loadComments();

// Render Single Comment
function renderComment(id, data) {
  // Ensure required variables are defined
  if (!currentUser || !OWNER_UID) {
    console.warn("currentUser or OWNER_UID is not defined");
  }

  // Validate and set defaults for data
  const safeData = {
    uid: data.uid || "",
    name: data.name || "Anonymous",
    text: data.text || "",
    created: data.created || null,
    edited: data.edited || false,
    likes: Array.isArray(data.likes) ? data.likes : [],
    dislikes: Array.isArray(data.dislikes) ? data.dislikes : [],
  };

  const isOwner = currentUser && safeData.uid && currentUser.uid === safeData.uid;
  const isAdmin = currentUser && currentUser.uid === OWNER_UID;
  const youLiked = currentUser && safeData.likes.includes(currentUser.uid);
  const youDisliked = currentUser && safeData.dislikes.includes(currentUser.uid);

  const div = document.createElement("div");
  div.className = "bg-white p-4 rounded shadow-sm";
  div.dataset.id = id; // Add comment ID for event handling

  // Build DOM elements safely
  const headerDiv = document.createElement("div");
  headerDiv.className = "flex justify-between";
  
  const namePara = document.createElement("p");
  namePara.className = "font-semibold";
  namePara.textContent = safeData.name;
  headerDiv.appendChild(namePara);

  const timePara = document.createElement("p");
  timePara.className = "text-xs text-gray-500";
  timePara.textContent = safeData.created && typeof timeAgo === "function" 
    ? `${timeAgo(safeData.created)}${safeData.edited ? " • edited" : ""}`
    : "Unknown time";
  headerDiv.appendChild(timePara);

  const textPara = document.createElement("p");
  textPara.className = "my-2";
  textPara.textContent = safeData.text;
  
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "flex items-center gap-4 text-sm";

  const likeBtn = document.createElement("button");
  likeBtn.className = `like-btn flex items-center gap-1 ${youLiked ? "text-blue-600" : ""}`;
  likeBtn.setAttribute("aria-label", "Like comment");
  likeBtn.innerHTML = `👍 <span>${safeData.likes.length}</span>`;
  actionsDiv.appendChild(likeBtn);

  const dislikeBtn = document.createElement("button");
  dislikeBtn.className = `dislike-btn flex items-center gap-1 ${youDisliked ? "text-red-600" : ""}`;
  dislikeBtn.setAttribute("aria-label", "Dislike comment");
  dislikeBtn.innerHTML = `👎 <span>${safeData.dislikes.length}</span>`;
  actionsDiv.appendChild(dislikeBtn);

  const replyBtn = document.createElement("button");
  replyBtn.className = "reply-btn";
  replyBtn.textContent = "Reply";
  actionsDiv.appendChild(replyBtn);

  if (isOwner || isAdmin) {
    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "Edit";
    actionsDiv.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn text-red-500";
    deleteBtn.textContent = "Delete";
    actionsDiv.appendChild(deleteBtn);
  }

  div.appendChild(headerDiv);
  div.appendChild(textPara);
  div.appendChild(actionsDiv);

  return div;
}
    <div class="ml-6 mt-2 reply-form hidden">
      <textarea rows="2" class="w-full border rounded p-2" placeholder="Write a reply..."></textarea>
      <button class="mt-1 px-3 py-1 bg-indigo-500 text-white rounded post-reply-btn">Reply</button>
    </div>
    <div class="ml-6 mt-2 replies"></div>
  `;

  // Like/dislike toggle (mutually exclusive)
  div.querySelector(".like-btn").onclick = () => toggleReaction(id, "likes", "dislikes");
  div.querySelector(".dislike-btn").onclick = () => toggleReaction(id, "dislikes", "likes");

  // Delete
  const del = div.querySelector(".delete-btn");
  if (del) del.onclick = async () => {
    if (confirm("Delete this comment?")) {
      await deleteDoc(doc(db, "comments", id));
      loadComments(true);
    }
  };

  // Edit
  const ed = div.querySelector(".edit-btn");
  if (ed) ed.onclick = async () => {
    const t = prompt("Edit your comment:", data.text);
    if (t != null) {
      await updateDoc(doc(db, "comments", id), { text: t, edited: true });
      loadComments(true);
    }
  };

  // Reply
  const repBtn = div.querySelector(".reply-btn");
  const repForm = div.querySelector(".reply-form");
  const postRep = div.querySelector(".post-reply-btn");
  const repliesCont = div.querySelector(".replies");

  repBtn.onclick = () => repForm.classList.toggle("hidden");
  postRep.onclick = async () => {
    if (!currentUser) return alert("Login first");
    const ta = repForm.querySelector("textarea");
    const txt = ta.value.trim();
    if (!txt) return;
    await addDoc(collection(db, "comments", id, "replies"), {
      text: txt,
      uid: currentUser.uid,
      name: currentUser.displayName || "Guest",
      created: serverTimestamp()
    });
    ta.value = "";
    repForm.classList.add("hidden");
    loadReplies(id, repliesCont);
  };

  // Load nested replies
  loadReplies(id, div.querySelector(".replies"));

  commentsDiv.appendChild(div);
}

// Toggle Reaction
async function toggleReaction(id, addF, removeF) {
  if (!currentUser) return alert("Login first");
  const ref = doc(db, "comments", id);
  const snap = await getDoc(ref);
  const data = snap.data();
  // Remove opposite
  if (data[removeF]?.includes(currentUser.uid)) {
    await updateDoc(ref, { [removeF]: arrayRemove(currentUser.uid) });
  }
  // Toggle
  const has = data[addF]?.includes(currentUser.uid);
  const op = has ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid);
  await updateDoc(ref, { [addF]: op });
  loadComments(true);
}

// Load Replies
async function loadReplies(parentId, container) {
  container.innerHTML = "";
  const snap = await getDocs(query(collection(db, "comments", parentId, "replies"), orderBy("created", "asc")));
  snap.forEach(r => {
    const d = r.data();
    const el = document.createElement("div");
    el.className = "bg-gray-50 p-2 rounded mb-1";
    el.innerHTML = `
      <div class="flex justify-between">
        <p class="text-sm font-semibold">${d.name}</p>
        <p class="text-xs text-gray-500">${d.created ? timeAgo(d.created) : ""}</p>
      </div>
      <p class="text-sm">${d.text}</p>
    `;
    container.appendChild(el);
  });
}

// Initial fetch
loadComments();
