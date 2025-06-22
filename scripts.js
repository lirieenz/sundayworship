const chords = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
let scrollInterval = null;

const songsData = [];
const transposeValues = {};
const db = firebase.firestore();
const songsRef = db.collection("songs");

function transposeChord(chord, steps) {
  const root = chord.match(/[A-G][#b]?/);
  if (!root) return chord;
  const i = chords.indexOf(root[0].replace('Db', 'C#').replace('Eb', 'D#'));
  if (i < 0) return chord;
  const newIndex = (i + steps + 12) % 12;
  return chord.replace(root[0], chords[newIndex]);
}

function getTransposed(raw, transpose) {
  const regex = /\b([A-G][#b]?m?7?)\b/g;
  const lines = raw.split('\n');
  return lines.map(line => {
    if (line.startsWith('[') && line.endsWith(']')) return line;
    return line.replace(regex, match => `<b>${transposeChord(match, transpose)}</b>`);
  }).join('\n');
}

function renderSongs() {
  const container = document.getElementById("songs");
  container.innerHTML = "";

  songsData.forEach(song => {
    const transpose = transposeValues[song.id] || 0;
    const html = `
      <h2>
        ${song.title}
        <button onclick="deleteSong('${song.id}')">🗑️</button>
        <button onclick="moveSong('${song.id}', -1)">↑</button>
        <button onclick="moveSong('${song.id}', 1)">↓</button>
      </h2>
      <div class="controls">
        <button onclick="transposeSong('${song.id}', -1)">Transpose -</button>
        <span style="margin: 0 10px;">Key: ${transpose >= 0 ? '+' + transpose : transpose}</span>
        <button onclick="transposeSong('${song.id}', 1)">Transpose +</button>
      </div>
      <pre><code>${getTransposed(song.raw, transpose)}</code></pre>
    `;
    container.innerHTML += html;
  });
}

function toggleScroll() {
  const speed = parseInt(document.getElementById("scrollSpeed").value);
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
  } else {
    scrollInterval = setInterval(() => {
      window.scrollBy({ top: 1, behavior: 'smooth' });
    }, speed);
  }
}

document.getElementById("scrollSpeed").addEventListener("input", () => {
  if (scrollInterval) {
    clearInterval(scrollInterval);
    const speed = parseInt(document.getElementById("scrollSpeed").value);
    scrollInterval = setInterval(() => {
      window.scrollBy({ top: 1, behavior: 'smooth' });
    }, speed);
  }
});

function importSong(event) {
  const file = event.target.files[0];
  if (!file || file.type !== "text/plain") {
    alert("Please select a valid .txt file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const raw = e.target.result.trim();
    if (!raw) return alert("The file is empty.");

    const id = `song_${Date.now()}`;
    const title = file.name.replace(/\.txt$/, '');

    songsRef.doc(id).set({
      id,
      title,
      raw,
      transpose: 0
    });
  };
  reader.readAsText(file);
}

function deleteSong(id) {
  songsRef.doc(id).delete();
}

function transposeSong(id, step) {
  const song = songsData.find(s => s.id === id);
  if (!song) return;
  const current = transposeValues[id] || 0;
  const updated = current + step;

  songsRef.doc(id).update({ transpose: updated });
}

function moveSong(id, direction) {
  const index = songsData.findIndex(song => song.id === id);
  if (index === -1) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= songsData.length) return;

  const temp = songsData[index];
  songsData[index] = songsData[newIndex];
  songsData[newIndex] = temp;

  renderSongs();
}

function importFromUG() {
  const url = prompt("Paste Ultimate Guitar URL:");
  if (!url) return;

  // WARM UP SERVER FIRST
  fetch('https://backend-wo7u.onrender.com')
    .then(() => {
      // Now do the actual POST
      return fetch('https://backend-wo7u.onrender.com/fetch-chords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
    })
    .then(res => res.json())
    .then(data => {
      if (data.error || !data.raw) {
        alert("Failed to fetch chords.");
        return;
      }

      const id = `ug_${Date.now()}`;
      const title = url.split('/').pop().replace(/[-_]/g, ' ').replace(/\.(crd|tab|pro|txt)/i, '');

      songsRef.doc(id).set({
        id,
        title,
        raw: data.raw,
        transpose: 0
      });
    })
    .catch(() => alert("Something went wrong. Check the link or try again."));
}

// Real-time sync from Firestore
songsRef.orderBy("title").onSnapshot(snapshot => {
  songsData.length = 0;
  snapshot.forEach(doc => {
    const song = doc.data();
    songsData.push(song);
    transposeValues[song.id] = song.transpose || 0;
  });
  renderSongs();
});

window.importFromUG = importFromUG;
window.importSong = importSong;
window.toggleScroll = toggleScroll;
window.transposeSong = transposeSong;
window.deleteSong = deleteSong;
window.moveSong = moveSong;
