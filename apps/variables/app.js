'use strict';

// ============================================================
// State
// ============================================================
let variables = [];
let selectedId = null;
let searchQuery = '';

// ============================================================
// DOM References
// ============================================================
const symbolListEl        = document.getElementById('symbol-list');
const editorPlaceholder   = document.getElementById('editor-placeholder');
const editorForm          = document.getElementById('editor-form');
const fieldName           = document.getElementById('field-name');
const fieldId             = document.getElementById('field-id');
const fieldBuiltIn        = document.getElementById('field-builtin');
const fieldBuiltInVersion = document.getElementById('field-builtin-version');
const fieldDescription    = document.getElementById('field-description');
const searchInput         = document.getElementById('search-input');
const fileInput           = document.getElementById('file-input');
const modalBulkImport     = document.getElementById('modal-bulk-import');
const bulkImportText      = document.getElementById('bulk-import-text');

// ============================================================
// YAML Parsing
// ============================================================

/**
 * Parse a YAML scalar value string into a JS primitive.
 */
function parseScalar(val) {
  if (val === 'true')  return true;
  if (val === 'false') return false;
  if (val === '' || val === 'null' || val === '~') return '';
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

/**
 * Parse a YAML document that follows the variable catalog schema.
 * Returns { FormatVersion, Data }.
 */
function parseYaml(text) {
  const lines = text.split('\n');
  const result = { FormatVersion: '1.0.0', Data: [] };
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // FormatVersion
    if (trimmed.startsWith('FormatVersion:')) {
      result.FormatVersion = parseScalar(trimmed.slice('FormatVersion:'.length).trim());
      i++;
      continue;
    }

    // Data array
    if (trimmed === 'Data:') {
      i++;
      while (i < lines.length) {
        const itemLine = lines[i];

        // New array item: starts with "  - "
        if (/^  - /.test(itemLine)) {
          const item = {};

          // First field is on the same line as "  - "
          const firstFieldStr = itemLine.slice(4); // strip "  - "
          parseFieldInto(item, firstFieldStr);
          i++;

          // Subsequent fields at 4-space indent
          while (i < lines.length) {
            const fl = lines[i];
            if (!/^    \S/.test(fl)) break;

            const content = fl.slice(4);
            const colonIdx = content.indexOf(':');
            if (colonIdx === -1) { i++; continue; }

            const key = content.slice(0, colonIdx);
            const val = content.slice(colonIdx + 1).trim();

            if (val === '|-') {
              // Block literal scalar — collect indented content lines
              i++;
              const contentLines = [];
              let contentIndent = -1;

              while (i < lines.length) {
                const cl = lines[i];
                if (cl.trim() === '') {
                  if (contentIndent !== -1) contentLines.push('');
                  i++;
                  continue;
                }
                const indent = cl.search(/\S/);
                if (contentIndent === -1) contentIndent = indent;
                if (indent >= contentIndent) {
                  contentLines.push(cl.slice(contentIndent));
                  i++;
                } else {
                  break;
                }
              }

              // |- strips trailing newlines
              while (contentLines.length > 0 && contentLines[contentLines.length - 1] === '') {
                contentLines.pop();
              }
              item[key] = contentLines.join('\n');
            } else {
              item[key] = parseScalar(val);
              i++;
            }
          }

          result.Data.push(item);
        } else if (lines[i].trim() === '') {
          i++;
        } else {
          break; // End of Data section
        }
      }
      continue;
    }

    i++;
  }

  return result;
}

/** Parse "Key: value" into obj[Key]. */
function parseFieldInto(obj, str) {
  const colonIdx = str.indexOf(':');
  if (colonIdx === -1) return;
  const key = str.slice(0, colonIdx).trim();
  const val = str.slice(colonIdx + 1).trim();
  obj[key] = parseScalar(val);
}

// ============================================================
// YAML Serialization
// ============================================================

/**
 * Return true if the string must be quoted to avoid YAML grammar errors.
 * When quoting is needed, single quotes are used per spec.
 */
function needsQuoting(s) {
  if (s === '') return true;
  // YAML reserved scalars (bool / null)
  if (/^(true|True|TRUE|false|False|FALSE|null|~|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF|y|Y|n|N)$/.test(s)) return true;
  // Starts with a YAML indicator character
  if (/^[{[\-?:,|>!"'#&*%@`]/.test(s)) return true;
  // Contains ': ' — looks like a mapping value
  if (/: /.test(s)) return true;
  // Ends with ':' — some parsers treat as mapping key
  if (s.endsWith(':')) return true;
  // Contains ' #' — YAML comment marker
  if (/ #/.test(s)) return true;
  // Looks like a numeric literal (int, float, hex, octal)
  if (/^[-+]?(\d[\d_]*(\.[\d_]*)?([eE][-+]?\d+)?|0x[\da-fA-F_]+|0o[0-7_]+)$/.test(s)) return true;
  // Contains a newline (would need a block scalar)
  if (s.includes('\n')) return true;
  return false;
}

/**
 * Serialize a string value for a YAML plain scalar field.
 * - No quoting when safe
 * - Single-quote wrapping when required (internal ' escaped as '')
 */
function serializeStr(s) {
  if (s == null) s = '';
  if (!needsQuoting(s)) return s;
  return "'" + s.replace(/'/g, "''") + "'";
}

/** Serialize the current variables array to a YAML string. */
function serializeYaml() {
  let yaml = `FormatVersion: 1.0.0\n`;
  yaml += `Data:\n`;

  for (const v of variables) {
    yaml += `  - Id: ${serializeStr(v.Id)}\n`;
    yaml += `    Name: ${serializeStr(v.Name)}\n`;
    yaml += `    BuiltIn: ${v.BuiltIn ? 'true' : 'false'}\n`;

    const desc = v.Description || '';
    if (desc === '') {
      yaml += `    Description: ""\n`;
    } else {
      yaml += `    Description: |-\n`;
      for (const line of desc.split('\n')) {
        yaml += line === '' ? '\n' : `      ${line}\n`;
      }
    }

    yaml += `    BuiltIntoVersion: ${serializeStr(v.BuiltIntoVersion)}\n`;
  }

  return yaml;
}

// ============================================================
// Rendering
// ============================================================

/** Re-render the symbol list, applying the current search filter. */
function renderSymbolList() {
  const q = searchQuery.toLowerCase();
  const filtered = variables.filter(v => v.Name.toLowerCase().includes(q));

  symbolListEl.innerHTML = '';

  for (const v of filtered) {
    const li = document.createElement('li');
    li.textContent = v.Name || '(unnamed)';
    li.dataset.id = v.Id;
    if (v.Id === selectedId) li.classList.add('active');
    li.addEventListener('click', () => selectSymbol(v.Id));
    symbolListEl.appendChild(li);
  }
}

/** Select a symbol and populate the editor form. */
function selectSymbol(id) {
  const v = variables.find(v => v.Id === id);
  if (!v) return;

  selectedId = id;

  // Update active highlight in list
  symbolListEl.querySelectorAll('li').forEach(li => {
    li.classList.toggle('active', li.dataset.id === id);
  });

  // Clear any leftover validation state from the previous symbol
  fieldName.classList.remove('input-error');
  document.getElementById('name-error').classList.remove('visible');
  fieldBuiltInVersion.classList.remove('input-error');
  document.getElementById('builtin-version-error').classList.remove('visible');

  // Populate form fields
  fieldName.value           = v.Name;
  fieldId.value             = v.Id;
  fieldBuiltIn.checked      = !!v.BuiltIn;
  fieldBuiltInVersion.value = v.BuiltIntoVersion || '';
  fieldDescription.value    = v.Description || '';

  // Show editor form
  editorPlaceholder.style.display = 'none';
  editorForm.style.display        = 'block';
}

/** Show the empty state placeholder and hide the form. */
function showPlaceholder() {
  selectedId = null;
  editorPlaceholder.style.display = 'flex';
  editorForm.style.display        = 'none';
}

// ============================================================
// Notification Toast
// ============================================================

let notificationTimer = null;

/** Show a slide-in toast notification, then auto-dismiss. */
function showNotification(message) {
  const el = document.getElementById('notification');
  el.textContent = message;

  // Cancel any in-progress animation/timer
  if (notificationTimer !== null) {
    clearTimeout(notificationTimer);
    notificationTimer = null;
  }
  el.className = '';
  // Force reflow so removing class takes effect before re-adding
  void el.offsetWidth;

  el.className = 'show';

  // After 2.5 s, play slide-out then hide
  notificationTimer = setTimeout(() => {
    el.className = 'hide';
    notificationTimer = setTimeout(() => {
      el.className = '';
      notificationTimer = null;
    }, 300); // matches slideOutToRight duration
  }, 2500);
}

// ============================================================
// State Mutations
// ============================================================

/** Read form values and write them back into the in-memory state. */
function saveFormToState() {
  if (!selectedId) return;
  const v = variables.find(v => v.Id === selectedId);
  if (!v) return;
  v.Name             = fieldName.value;
  v.BuiltIn          = fieldBuiltIn.checked;
  v.BuiltIntoVersion = fieldBuiltInVersion.value;
  v.Description      = fieldDescription.value;
}

/**
 * Validate required form fields.
 * Highlights invalid fields, shows error messages, and returns true only if all are valid.
 */
function validateForm() {
  let valid = true;

  // Name: required
  const nameError = document.getElementById('name-error');
  if (fieldName.value.trim() === '') {
    fieldName.classList.add('input-error');
    nameError.classList.add('visible');
    valid = false;
  } else {
    fieldName.classList.remove('input-error');
    nameError.classList.remove('visible');
  }

  // BuiltIntoVersion: required
  const versionError = document.getElementById('builtin-version-error');
  if (fieldBuiltInVersion.value.trim() === '') {
    fieldBuiltInVersion.classList.add('input-error');
    versionError.classList.add('visible');
    valid = false;
  } else {
    fieldBuiltInVersion.classList.remove('input-error');
    versionError.classList.remove('visible');
  }

  return valid;
}

/** Create a new variable object with default values. */
function createVariable(name = '', description = '') {
  return {
    Id:               crypto.randomUUID(),
    Name:             name,
    BuiltIn:          true,
    Description:      description,
    BuiltIntoVersion: 'N/A',
  };
}

// ============================================================
// Event Handlers
// ============================================================

function handleFileLoad(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = parseYaml(evt.target.result);
      variables = (parsed.Data || []).map(item => ({
        Id:               item.Id               || crypto.randomUUID(),
        Name:             item.Name             || '',
        BuiltIn:          item.BuiltIn !== false,
        Description:      item.Description      || '',
        BuiltIntoVersion: item.BuiltIntoVersion || 'N/A',
      }));
      showPlaceholder();
      renderSymbolList();
      showNotification(`Loaded ${variables.length} symbol(s)`);
    } catch (err) {
      alert('Failed to parse YAML:\n' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Allow re-loading the same file
}

function handleExport() {
  const yaml = serializeYaml();
  const blob = new Blob([yaml], { type: 'text/yaml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'variables.yaml';
  a.click();
  URL.revokeObjectURL(url);
  showNotification('Exported');
}

function handleNewSymbol() {
  const v = createVariable();
  variables.push(v);
  renderSymbolList();
  selectSymbol(v.Id);
  fieldName.focus();
  showNotification('New symbol created');
}

function handleSave() {
  if (!validateForm()) return;
  saveFormToState();
  renderSymbolList();
  showNotification('Saved');
}

function handleDelete() {
  if (!selectedId) return;
  const idx = variables.findIndex(v => v.Id === selectedId);
  if (idx === -1) return;
  variables.splice(idx, 1);
  showPlaceholder();
  renderSymbolList();
  showNotification('Deleted');
}

function handleBulkImportOpen() {
  bulkImportText.value = '';
  modalBulkImport.classList.add('open');
  bulkImportText.focus();
}

function handleBulkImportClose() {
  modalBulkImport.classList.remove('open');
}

function handleBulkImportConfirm() {
  const names = bulkImportText.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '');

  for (const name of names) {
    variables.push(createVariable(name, `Built-in Variable: ${name}`));
  }

  handleBulkImportClose();
  renderSymbolList();
  showNotification(`Imported ${names.length} symbol(s)`);
}

// ============================================================
// Event Bindings
// ============================================================

// Header buttons
document.getElementById('btn-load-yaml').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileLoad);

document.getElementById('btn-export').addEventListener('click', handleExport);
document.getElementById('btn-new-symbol').addEventListener('click', handleNewSymbol);
document.getElementById('btn-bulk-import').addEventListener('click', handleBulkImportOpen);

// Save / Delete buttons in form
document.getElementById('btn-save').addEventListener('click', handleSave);
document.getElementById('btn-delete').addEventListener('click', handleDelete);

// Clear validation error (border + message) when user starts correcting the field
fieldName.addEventListener('input', () => {
  fieldName.classList.remove('input-error');
  document.getElementById('name-error').classList.remove('visible');
});
fieldBuiltInVersion.addEventListener('input', () => {
  fieldBuiltInVersion.classList.remove('input-error');
  document.getElementById('builtin-version-error').classList.remove('visible');
});

// Search
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderSymbolList();
});

// Bulk Import modal buttons
document.getElementById('btn-bulk-cancel').addEventListener('click', handleBulkImportClose);
document.getElementById('btn-bulk-confirm').addEventListener('click', handleBulkImportConfirm);

// Close modal when clicking the backdrop
modalBulkImport.addEventListener('click', (e) => {
  if (e.target === modalBulkImport) handleBulkImportClose();
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalBulkImport.classList.contains('open')) {
    handleBulkImportClose();
  }
});
