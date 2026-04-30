// src/works.js

const modules = import.meta.glob(
  "/src/assets/selected_works/**/*.{png,jpg,jpeg,webp,gif,pdf}",
  { eager: true, import: "default" }
);

// ----------------------------------
// BUILD DATA

const images = Object.entries(modules).map(([path, url]) => {
  const match = path.match(/selected_works\/([^/]+)/);

  return {
    url,
    path,
    category: match ? match[1].toLowerCase() : "unknown"
  };
});

// ----------------------------------
// TRUE RANDOM SHUFFLE

function shuffle(arr) {
  return arr
    .map(item => ({ ...item, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map(({ r, ...rest }) => rest);
}

// ----------------------------------
// DOM

const gallery = document.querySelector(".gallery");
const viewer = document.getElementById("viewer");
const viewerImg = document.getElementById("viewerImg");
const caption = document.getElementById("caption");

let currentIndex = 0;
let filtered = [];

// ----------------------------------
// CLEAN NAME

function cleanName(path) {
  let file = path.split("/").pop();
  try { file = decodeURIComponent(file); } catch {}

  return file
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]/g, " ");
}

// ----------------------------------
// BUILD GALLERY (🔥 VISUAL RANDOMNESS)

function buildGallery(data) {
  gallery.innerHTML = "";

  data.forEach((img, i) => {
    const div = document.createElement("div");
    div.className = "item";

    // 🔥 RANDOM VISUAL VARIATION (THIS IS THE KEY)
    const scale = 0.9 + Math.random() * 0.2;
    const offset = Math.random() * 20;

    div.style.transform = `scale(${scale})`;
    div.style.marginTop = `${offset}px`;

    const image = document.createElement("img");
    image.src = img.url;
    image.loading = "lazy";

    div.appendChild(image);

    div.addEventListener("click", () => {
      currentIndex = i;
      openViewer();
    });

    gallery.appendChild(div);
  });
}

// ----------------------------------
// VIEWER

function openViewer() {
  viewer.style.display = "flex";
  updateViewer();
}

function closeViewer() {
  viewer.style.display = "none";
}

function updateViewer() {
  const item = filtered[currentIndex];
  viewerImg.src = item.url;
  caption.textContent = cleanName(item.path);
}

// ----------------------------------
// NAV

document.querySelector(".left").onclick = () => {
  currentIndex = (currentIndex - 1 + filtered.length) % filtered.length;
  updateViewer();
};

document.querySelector(".right").onclick = () => {
  currentIndex = (currentIndex + 1) % filtered.length;
  updateViewer();
};

document.querySelector(".close").onclick = closeViewer;

window.addEventListener("keydown", (e) => {
  if (viewer.style.display !== "flex") return;

  if (e.key === "Escape") closeViewer();
  if (e.key === "ArrowRight") document.querySelector(".right").click();
  if (e.key === "ArrowLeft") document.querySelector(".left").click();
});

// ----------------------------------
// FILTERS

document.querySelectorAll(".filters button").forEach(btn => {
  btn.addEventListener("click", () => {
    const filter = btn.dataset.filter.toLowerCase();

    if (filter === "all") {
      filtered = shuffle(images);
    } else {
      filtered = shuffle(
        images.filter(img => img.category === filter)
      );
    }

    currentIndex = 0;
    buildGallery(filtered);
  });
});

// ----------------------------------
// INIT

function init() {
  filtered = shuffle(images);

  console.log(
    "VISIBLE ORDER:",
    filtered.map(i => i.path.split("/").pop())
  );

  buildGallery(filtered);
}

init();