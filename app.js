const BEREICHE = [
  { key: 'Mast', label: 'Sendemast' },
  { key: 'Mast', label: 'Steigleiter' },
  { key: 'Kabine', label: 'Kabine / Betriebshaus' },
  { key: 'Mast', label: 'Kabel am Mast' },
  { key: 'Grundstück', label: 'Grundstück / Zaun' },
  { key: 'Zufahrt', label: 'Zufahrt' },
  { key: 'Energietechnik', label: 'ZAS Elektro-Anschlusskasten' },
];

const state = {
  selectedStandort: null,
  targetDir: null,
  queue: [],
  activeBereich: null,
};

const standortSelect = document.getElementById('standortSelect');
const targetFolderBtn = document.getElementById('targetFolderBtn');
const targetFolderPath = document.getElementById('targetFolderPath');
const dropGrid = document.getElementById('dropGrid');
const fileQueue = document.getElementById('fileQueue');
const queueItemTemplate = document.getElementById('queueItemTemplate');
const hiddenFileInput = document.getElementById('hiddenFileInput');

init();

function init() {
  fillStandorte();
  renderDropZones();
  targetFolderBtn.addEventListener('click', chooseTargetFolder);
  standortSelect.addEventListener('change', () => {
    state.selectedStandort = STANDORTE.find((s) => s.nummer === standortSelect.value) || null;
    renderQueue();
  });
  hiddenFileInput.addEventListener('change', (event) => {
    if (!state.activeBereich) return;
    handleFiles(Array.from(event.target.files || []), state.activeBereich);
    hiddenFileInput.value = '';
  });
}

function fillStandorte() {
  standortSelect.innerHTML = '<option value="">Bitte Standort wählen</option>';
  STANDORTE.forEach((s) => {
    const option = document.createElement('option');
    option.value = s.nummer;
    option.textContent = `${s.nummer} ${s.name}`;
    standortSelect.appendChild(option);
  });
}

function renderDropZones() {
  dropGrid.innerHTML = '';
  BEREICHE.forEach((bereich) => {
    const zone = document.createElement('button');
    zone.type = 'button';
    zone.className = 'drop-zone';
    zone.textContent = bereich.label;

    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('active');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('active'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('active');
      handleFiles(Array.from(event.dataTransfer?.files || []), bereich);
    });
    zone.addEventListener('click', () => {
      state.activeBereich = bereich;
      hiddenFileInput.click();
    });

    dropGrid.appendChild(zone);
  });
}

async function handleFiles(files, bereich) {
  const jpgs = files.filter((f) => /image\/jpe?g/i.test(f.type) || /\.jpe?g$/i.test(f.name));
  for (const file of jpgs) {
    const compressed = await compressToLimit(file, 1024 * 1024);
    const today = new Date();
    const aufnahmedatum = `${today.getFullYear()}${`${today.getMonth() + 1}`.padStart(2, '0')}${`${today.getDate()}`.padStart(2, '0')}`;
    const standortNummer = state.selectedStandort?.nummer || '0000';
    const entry = {
      id: crypto.randomUUID(),
      file: compressed,
      oldName: file.name,
      parts: {
        nummer: standortNummer,
        datum: aufnahmedatum,
        sache: bereich.key,
        kommentar: '',
      },
    };
    state.queue.unshift(entry);
    if (state.targetDir && state.selectedStandort) {
      await saveEntry(entry);
    }
  }
  renderQueue();
}

async function compressToLimit(file, maxBytes) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.9;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  return new File([blob], replaceExtension(file.name, '.jpg'), { type: 'image/jpeg' });
}

function replaceExtension(filename, ext) {
  return filename.replace(/\.[^/.]+$/, '') + ext;
}

function buildFilename(parts) {
  const base = `${parts.nummer}_${parts.datum}_${parts.sache}`;
  return `${parts.kommentar ? `${base}_${parts.kommentar}` : base}.jpg`;
}

function buildSubPath(parts) {
  const standortName = state.selectedStandort ? `${state.selectedStandort.nummer} ${state.selectedStandort.name}` : `${parts.nummer} Unbekannt`;
  return `${standortName}/Bilder/${parts.sache}`;
}

async function chooseTargetFolder() {
  if (!window.showDirectoryPicker) {
    alert('Der Browser unterstützt keinen Ordnerzugriff. Bitte Chromium/Edge verwenden.');
    return;
  }
  state.targetDir = await window.showDirectoryPicker();
  targetFolderPath.textContent = state.targetDir.name;

  if (state.selectedStandort) {
    for (const entry of state.queue) {
      await saveEntry(entry);
    }
  }
}

async function saveEntry(entry) {
  try {
    const standortFolderName = `${state.selectedStandort.nummer} ${state.selectedStandort.name}`;
    const standortDir = await state.targetDir.getDirectoryHandle(standortFolderName, { create: true });
    const bilderDir = await standortDir.getDirectoryHandle('Bilder', { create: true });
    const bereichDir = await bilderDir.getDirectoryHandle(entry.parts.sache, { create: true });
    const filename = buildFilename(entry.parts);
    const fileHandle = await bereichDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(entry.file);
    await writable.close();
  } catch (error) {
    console.error('Fehler beim Speichern', error);
  }
}

function renderQueue() {
  fileQueue.innerHTML = '';
  state.queue.forEach((entry) => {
    const node = queueItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.new-name').textContent = buildFilename(entry.parts);
    node.querySelector('.old-name').textContent = `Vorher: ${entry.oldName}`;
    node.querySelector('.subpath').textContent = `Pfad: ${buildSubPath(entry.parts)}`;

    const editor = node.querySelector('.name-editor');
    ['nummer', 'datum', 'sache', 'kommentar'].forEach((key) => {
      const input = document.createElement('input');
      input.value = entry.parts[key];
      input.placeholder = key;
      input.title = key;
      input.addEventListener('change', async () => {
        entry.parts[key] = sanitize(input.value);
        if (key === 'kommentar' && !input.value.trim()) {
          entry.parts.kommentar = '';
        }
        node.querySelector('.new-name').textContent = buildFilename(entry.parts);
        node.querySelector('.subpath').textContent = `Pfad: ${buildSubPath(entry.parts)}`;
        if (state.targetDir && state.selectedStandort) {
          await saveEntry(entry);
        }
      });
      editor.appendChild(input);
    });

    node.querySelector('.delete-btn').addEventListener('click', () => {
      state.queue = state.queue.filter((item) => item.id !== entry.id);
      renderQueue();
    });

    fileQueue.appendChild(node);
  });
}

function sanitize(value) {
  return value.trim().replace(/[\\/:*?"<>|]/g, '-');
}
