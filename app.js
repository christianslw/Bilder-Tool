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
      element.classList.add('active');
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('active');
    });

    element.addEventListener('drop', async (event) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.includes('jpeg') || file.type.includes('jpg'));
      element.classList.remove('active');
      if (files.length) {
        await addFilesToZone(files, element.dataset.zone);
      }
    });
  });
}

function setActiveZone(zone) {
  state.activeZone = zone;
  document.querySelectorAll('[data-zone]').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll(`[data-zone="${zone}"]`).forEach((el) => el.classList.add('active'));
}

async function pickFolder() {
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await window.showDirectoryPicker();
      state.folderHandle = handle;
      state.folderName = handle.name;
      folderFallbackInput.value = handle.name;
    } catch {
      // Benutzer hat ggf. abgebrochen
    }
  } else {
    alert('Directory Picker nicht verfügbar. Bitte Fallback-Pfad eintragen.');
  }
}

async function addFilesToZone(files, zone) {
  setActiveZone(zone);

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
  const ext = '.jpg';

  const segments = {
    nummer,
    datum: datePart,
    sache: zone,
    kommentar: comment
  };

  const folderPath = `${getRootFolder()}/${nummer} ${standortName}/Bilder/${zoneToFolder[zone] || zone}`;
  const generatedName = buildFileName(segments, ext);

  return {
    id: crypto.randomUUID(),
    file,
    ext,
    originalName,
    oldGeneratedName: generatedName,
    segments,
    folderPath
  };
}

function buildFileName(segments, ext) {
  const base = `${segments.nummer}_${segments.datum}_${segments.sache}`;
  return `${base}${segments.kommentar ? `_${segments.kommentar}` : ''}${ext}`;
}

function renderEntry(entry) {
  const node = fileItemTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = entry.id;
  const pathEl = node.querySelector('.path');
  const editor = node.querySelector('.name-editor');
  const oldName = node.querySelector('.old-name');
  const deleteBtn = node.querySelector('.delete');

  pathEl.textContent = `${entry.folderPath}/${buildFileName(entry.segments, entry.ext)}`;
  oldName.textContent = `Vorher: ${entry.originalName}`;
  editor.innerHTML = '';

  const pieceOrder = [
    ['nummer', true],
    ['_', false],
    ['datum', true],
    ['_', false],
    ['sache', true],
    ['kommentar', true, true],
    [entry.ext, false]
  ];

  for (const piece of pieceOrder) {
    if (piece[0] === 'kommentar' && !entry.segments.kommentar) {
      continue;
    }

    const span = document.createElement('span');
    if (piece[1]) {
      span.className = 'segment';
      span.contentEditable = 'true';
      span.dataset.key = piece[0];
      span.textContent = piece[0] === 'kommentar' ? `_${entry.segments.kommentar}` : entry.segments[piece[0]];

      span.addEventListener('blur', () => {
        let content = sanitize(span.textContent || '');
        if (piece[0] === 'kommentar') {
          content = sanitize(content.replace(/^_+/, ''));
          entry.segments.kommentar = content;
          if (!content) {
            span.remove();
          } else {
            span.textContent = `_${content}`;
          }
        } else {
          entry.segments[piece[0]] = content || entry.segments[piece[0]];
          span.textContent = entry.segments[piece[0]];
        }

        pathEl.textContent = `${entry.folderPath}/${buildFileName(entry.segments, entry.ext)}`;
      });
    } else {
      span.textContent = piece[0];
    }
    editor.appendChild(span);
  }

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

function getRootFolder() {
  return folderFallbackInput.value.trim() || state.folderName;
}

async function persistIfPossible(entry) {
  if (!state.folderHandle) {
    return;
  }

  try {
    const standortFolder = await state.folderHandle.getDirectoryHandle(
      `${entry.segments.nummer} ${standortSelect.selectedOptions[0]?.dataset.name || 'UNBEKANNT'}`,
      { create: true }
    );
    const bilderFolder = await standortFolder.getDirectoryHandle('Bilder', { create: true });
    const zoneFolder = await bilderFolder.getDirectoryHandle(zoneToFolder[entry.segments.sache] || entry.segments.sache, { create: true });
    const fileHandle = await zoneFolder.getFileHandle(buildFileName(entry.segments, entry.ext), { create: true });
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

  let quality = 0.92;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > maxBytes) {
    const smallerCanvas = document.createElement('canvas');
    smallerCanvas.width = Math.round(canvas.width * 0.8);
    smallerCanvas.height = Math.round(canvas.height * 0.8);
    smallerCanvas.getContext('2d').drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
    blob = await canvasToBlob(smallerCanvas, Math.max(quality, 0.45));
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
