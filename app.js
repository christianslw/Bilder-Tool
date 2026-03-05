const pickFolderBtn = document.getElementById('pickFolderBtn');
const folderFallbackInput = document.getElementById('folderFallbackInput');
const standortSelect = document.getElementById('standortSelect');
const dateInput = document.getElementById('dateInput');
const commentInput = document.getElementById('commentInput');
const fileList = document.getElementById('fileList');
const hiddenFileInput = document.getElementById('hiddenFileInput');
const fileItemTemplate = document.getElementById('fileItemTemplate');

const state = {
  folderName: 'Kein Zielordner',
  folderHandle: null,
  activeZone: null,
  items: []
};

const zoneToFolder = {
  Grundstück: 'Grundstück',
  Kabine: 'Kabine',
  Mast: 'Mast',
  Energietechnik: 'Energietechnik',
  Zufahrt: 'Zufahrt'
};

initialize();

function initialize() {
  const now = new Date();
  dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (const standort of window.STANDORTE || []) {
    const option = document.createElement('option');
    option.value = standort.nummer;
    option.textContent = `${standort.nummer} ${standort.name}`;
    option.dataset.name = standort.name;
    standortSelect.appendChild(option);
  }

  if (!standortSelect.options.length) {
    const option = document.createElement('option');
    option.value = '0000';
    option.dataset.name = 'UNBEKANNT';
    option.textContent = '0000 UNBEKANNT';
    standortSelect.appendChild(option);
  }

  bindZoneEvents();
  bindGlobalEvents();
}

function bindGlobalEvents() {
  pickFolderBtn.addEventListener('click', pickFolder);

  hiddenFileInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length && state.activeZone) {
      await addFilesToZone(files, state.activeZone);
    }
    hiddenFileInput.value = '';
  });
}

function bindZoneEvents() {
  document.querySelectorAll('[data-zone]').forEach((element) => {
    element.style.cursor = 'pointer';
    element.addEventListener('click', () => {
      setActiveZone(element.dataset.zone);
      hiddenFileInput.click();
    });

    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setActiveZone(element.dataset.zone);
        hiddenFileInput.click();
      }
    });

    element.addEventListener('dragover', (event) => {
      event.preventDefault();
      setActiveZone(element.dataset.zone);
      element.classList.add('opacity-80');
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('opacity-80');
    });

    element.addEventListener('drop', async (event) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.includes('jpeg') || file.type.includes('jpg'));
      element.classList.remove('opacity-80');
      if (files.length) {
        await addFilesToZone(files, element.dataset.zone);
      }
    });
  });
}

function setActiveZone(zone) {
  state.activeZone = zone;
}

async function pickFolder() {
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await window.showDirectoryPicker();
      state.folderHandle = handle;
      state.folderName = handle.name;
      folderFallbackInput.value = handle.name;
    } catch {
      // Abbruch
    }
  } else {
    alert('Directory Picker nicht verfügbar. Bitte Fallback-Pfad eintragen.');
  }
}

async function addFilesToZone(files, zone) {
  for (const file of files) {
    const compressed = await compressJpeg(file, 1024 * 1024);
    const entry = createEntry(compressed, zone, file.name);
    state.items.unshift(entry);
    renderEntry(entry);
    await persistIfPossible(entry);
  }
}

function createEntry(file, zone, originalName) {
  const selected = standortSelect.selectedOptions[0];
  const nummer = selected?.value || '0000';
  const standortName = selected?.dataset.name || 'UNBEKANNT';
  const datePart = (dateInput.value || '1970-01-01').replaceAll('-', '');
  const comment = sanitize(commentInput.value);

  const fileName = `${nummer}_${datePart}_${zone}${comment ? `_${comment}` : ''}.jpg`;
  const folderPath = `${getRootFolder()}/${nummer} ${standortName}/Bilder/${zoneToFolder[zone] || zone}`;

  return {
    id: crypto.randomUUID(),
    file,
    originalName,
    currentName: fileName,
    folderPath,
    zone,
    standortName
  };
}

function renderEntry(entry) {
  const node = fileItemTemplate.content.firstElementChild.cloneNode(true);
  const pathEl = node.querySelector('.path');
  const editableName = node.querySelector('.editable-name');
  const oldName = node.querySelector('.old-name');
  const deleteBtn = node.querySelector('.delete');

  const refreshPath = () => {
    pathEl.textContent = `${entry.folderPath}/${entry.currentName}`;
  };

  editableName.textContent = entry.currentName;
  oldName.textContent = `Vorher: ${entry.originalName}`;
  refreshPath();

  editableName.addEventListener('blur', () => {
    entry.currentName = normalizeFilename(editableName.textContent || entry.currentName);
    editableName.textContent = entry.currentName;
    refreshPath();
  });

  editableName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      editableName.blur();
    }
  });

  deleteBtn.addEventListener('click', () => {
    state.items = state.items.filter((item) => item.id !== entry.id);
    node.remove();
  });

  fileList.prepend(node);
}

function sanitize(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '')
    .replace(/\s+/g, '-');
}

function normalizeFilename(name) {
  const parts = String(name || '')
    .trim()
    .replace(/\.(jpg|jpeg)$/i, '')
    .split('_')
    .map((part) => sanitize(part))
    .filter(Boolean);

  const cleaned = parts.join('_') || '0000_19700101_Mast';
  return `${cleaned}.jpg`;
}

function getRootFolder() {
  return folderFallbackInput.value.trim() || state.folderName;
}

async function persistIfPossible(entry) {
  if (!state.folderHandle) {
    return;
  }

  try {
    const selected = standortSelect.selectedOptions[0];
    const standortFolder = await state.folderHandle.getDirectoryHandle(`${selected?.value || '0000'} ${selected?.dataset.name || entry.standortName}`, { create: true });
    const bilderFolder = await standortFolder.getDirectoryHandle('Bilder', { create: true });
    const zoneFolder = await bilderFolder.getDirectoryHandle(zoneToFolder[entry.zone] || entry.zone, { create: true });
    const fileHandle = await zoneFolder.getFileHandle(entry.currentName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(entry.file);
    await writable.close();
  } catch (error) {
    console.warn('Datei konnte nicht geschrieben werden', error);
  }
}

async function compressJpeg(file, maxBytes) {
  if (file.size <= maxBytes) {
    return file;
  }

  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxDimension = 2200;
  const ratio = Math.min(1, maxDimension / Math.max(imageBitmap.width, imageBitmap.height));
  canvas.width = Math.round(imageBitmap.width * ratio);
  canvas.height = Math.round(imageBitmap.height * ratio);
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.9;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Blob-Erstellung fehlgeschlagen'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}
