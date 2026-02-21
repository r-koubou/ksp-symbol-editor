'use strict';

// ============================================================
// State
// ============================================================
let uiTypes = [];
let selectedId = null;
let searchQuery = '';
let editingArgIndex = null; // null = new, number = editing index

// ============================================================
// DOM References
// ============================================================
const symbolListEl           = document.getElementById('symbol-list');
const editorPlaceholder      = document.getElementById('editor-placeholder');
const editorForm             = document.getElementById('editor-form');
const fieldName              = document.getElementById('field-name');
const fieldId                = document.getElementById('field-id');
const fieldBuiltIn           = document.getElementById('field-builtin');
const fieldVariableType      = document.getElementById('field-variable-type');
const fieldRequireInitializer = document.getElementById('field-require-initializer');
const fieldBuiltInVersion    = document.getElementById('field-builtin-version');
const fieldDescription       = document.getElementById('field-description');
const argTbody               = document.getElementById('arg-tbody');
const argTableEmpty          = document.getElementById('arg-table-empty');
const searchInput            = document.getElementById('search-input');
const fileInput              = document.getElementById('file-input');
const modalBulkImport        = document.getElementById('modal-bulk-import');
const bulkImportText         = document.getElementById('bulk-import-text');
const modalArgEdit           = document.getElementById('modal-arg-edit');
const argFieldName           = document.getElementById('arg-field-name');
const argFieldDatatype       = document.getElementById('arg-field-datatype');
const argFieldDescription    = document.getElementById('arg-field-description');

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
 * Parse a YAML document following the UI type catalog schema.
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
          const item = { InitializerArguments: [] };

          // First field on the same line as "  - "
          const firstFieldStr = itemLine.slice(4);
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

            if (key === 'InitializerArguments') {
              i++;
              // Empty inline array
              if (val === '[]') {
                item.InitializerArguments = [];
                continue;
              }
              // Sequence of argument objects at 6-space indent
              item.InitializerArguments = [];
              while (i < lines.length) {
                const argLine = lines[i];
                if (/^      - /.test(argLine)) {
                  const arg = {};
                  const argFirstStr = argLine.slice(8); // strip "      - "
                  parseFieldInto(arg, argFirstStr);
                  i++;
                  // Argument sub-fields at 8-space indent
                  while (i < lines.length) {
                    const afl = lines[i];
                    if (!/^        \S/.test(afl)) break;
                    const aContent = afl.slice(8);
                    const aColonIdx = aContent.indexOf(':');
                    if (aColonIdx === -1) { i++; continue; }
                    const aKey = aContent.slice(0, aColonIdx);
                    const aVal = aContent.slice(aColonIdx + 1).trim();
                    if (aVal === '|-') {
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
                      while (contentLines.length > 0 && contentLines[contentLines.length - 1] === '') {
                        contentLines.pop();
                      }
                      arg[aKey] = contentLines.join('\n');
                    } else {
                      arg[aKey] = parseScalar(aVal);
                      i++;
                    }
                  }
                  item.InitializerArguments.push(arg);
                } else if (argLine.trim() === '') {
                  i++;
                } else {
                  break;
                }
              }
            } else if (val === '|-') {
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
          break;
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
// Data Type Component
// ============================================================

const DATA_TYPES = ['V', 'I', 'R', 'S', 'B', 'P', 'I[]', 'R[]', 'S[]', 'B[]', 'ui_*', '*'];

/**
 * Parse a data type string like "I||S[]" into an array of types.
 */
function parseDataTypes(text) {
  if (!text || text.trim() === '') return [];
  return text.split('||').map(t => t.trim()).filter(t => t !== '');
}

/**
 * Sync Quick Selection checkboxes from a text input value.
 */
function syncCheckboxes(qsContainerId, text) {
  const selected = new Set(parseDataTypes(text));
  const container = document.getElementById(qsContainerId);
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = selected.has(cb.value);
  });
}

/**
 * Build data type string from checked checkboxes in a Quick Selection container.
 * Preserve the canonical order from DATA_TYPES.
 */
function buildTextFromCheckboxes(qsContainerId) {
  const container = document.getElementById(qsContainerId);
  const checked = [];
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    if (cb.checked) checked.push(cb.value);
  });
  return checked.join('||');
}

/**
 * Set up bidirectional sync between a text input and a Quick Selection container.
 */
function setupDataTypeComponent(inputId, qsContainerId) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(qsContainerId);

  // Text → checkboxes
  input.addEventListener('input', () => {
    syncCheckboxes(qsContainerId, input.value);
  });

  // Checkboxes → text
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      input.value = buildTextFromCheckboxes(qsContainerId);
    });
  });
}

// ============================================================
// YAML Serialization
// ============================================================

/**
 * Return true if the string must be quoted in YAML.
 * When quoting is needed, single quotes are used per spec.
 */
function needsQuoting(s) {
  if (s === '') return true;
  if (/^(true|True|TRUE|false|False|FALSE|null|~|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF|y|Y|n|N)$/.test(s)) return true;
  if (/^[{[\-?:,|>!"'#&*%@`]/.test(s)) return true;
  if (/: /.test(s)) return true;
  if (s.endsWith(':')) return true;
  if (/ #/.test(s)) return true;
  if (/^[-+]?(\d[\d_]*(\.[\d_]*)?([eE][-+]?\d+)?|0x[\da-fA-F_]+|0o[0-7_]+)$/.test(s)) return true;
  if (s.includes('\n')) return true;
  return false;
}

/**
 * Serialize a string value for a YAML plain scalar field.
 */
function serializeStr(s) {
  if (s == null) s = '';
  if (!needsQuoting(s)) return s;
  return "'" + s.replace(/'/g, "''") + "'";
}

/**
 * Serialize Description field per spec:
 * - empty → `Description: ""`
 * - non-empty → `Description: |-\n  content`
 */
function serializeDescription(desc, indent) {
  const d = desc || '';
  if (d === '') {
    return `${indent}Description: ""\n`;
  }
  let out = `${indent}Description: |-\n`;
  for (const line of d.split('\n')) {
    out += line === '' ? '\n' : `${indent}  ${line}\n`;
  }
  return out;
}

/** Serialize the current uiTypes array to a YAML string. */
function serializeYaml() {
  let yaml = `FormatVersion: 1.1.0\n`;
  yaml += `Data:\n`;

  for (const u of uiTypes) {
    yaml += `  - Id: ${serializeStr(u.Id)}\n`;
    yaml += `    Name: ${serializeStr(u.Name)}\n`;
    yaml += `    BuiltIn: ${u.BuiltIn ? 'true' : 'false'}\n`;
    yaml += `    VariableType: ${serializeStr(u.VariableType)}\n`;
    yaml += serializeDescription(u.Description, '    ');
    yaml += `    BuiltIntoVersion: ${serializeStr(u.BuiltIntoVersion)}\n`;
    yaml += `    RequireInitializer: ${u.RequireInitializer ? 'true' : 'false'}\n`;

    const args = u.InitializerArguments || [];
    if (args.length === 0) {
      yaml += `    InitializerArguments: []\n`;
    } else {
      yaml += `    InitializerArguments:\n`;
      for (const arg of args) {
        yaml += `      - Name: ${serializeStr(arg.Name)}\n`;
        yaml += `        DataType: ${serializeStr(arg.DataType)}\n`;
        yaml += serializeDescription(arg.Description, '        ');
      }
    }
  }

  return yaml;
}

// ============================================================
// Rendering
// ============================================================

/** Re-render the symbol list, applying the current search filter. */
function renderSymbolList() {
  const q = searchQuery.toLowerCase();
  const filtered = uiTypes.filter(u => u.Name.toLowerCase().includes(q));

  symbolListEl.innerHTML = '';

  for (const u of filtered) {
    const li = document.createElement('li');
    li.textContent = u.Name || '(unnamed)';
    li.dataset.id = u.Id;
    if (u.Id === selectedId) li.classList.add('active');
    li.addEventListener('click', () => selectSymbol(u.Id));
    symbolListEl.appendChild(li);
  }
}

/** Render the InitializerArguments table for the currently selected UI type. */
function renderArgTable(args) {
  argTbody.innerHTML = '';

  if (!args || args.length === 0) {
    argTableEmpty.classList.add('visible');
    return;
  }

  argTableEmpty.classList.remove('visible');

  args.forEach((arg, idx) => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.className = 'arg-td-name';
    tdName.textContent = arg.Name || '';
    tdName.title = arg.Name || '';

    const tdType = document.createElement('td');
    tdType.className = 'arg-td-datatype';
    tdType.textContent = arg.DataType || '';
    tdType.title = arg.DataType || '';

    const tdDesc = document.createElement('td');
    tdDesc.className = 'arg-td-desc';
    tdDesc.textContent = arg.Description || '';
    tdDesc.title = arg.Description || '';

    const tdAction = document.createElement('td');
    tdAction.className = 'arg-td-action';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-sm btn-sm-edit';
    btnEdit.textContent = 'Edit';
    btnEdit.addEventListener('click', () => openArgModal(idx));

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-sm btn-sm-delete';
    btnDel.textContent = 'Delete';
    btnDel.addEventListener('click', () => deleteArg(idx));

    tdAction.appendChild(btnEdit);
    tdAction.appendChild(btnDel);

    tr.appendChild(tdName);
    tr.appendChild(tdType);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAction);
    argTbody.appendChild(tr);
  });
}

/** Select a UI type and populate the editor form. */
function selectSymbol(id) {
  const u = uiTypes.find(u => u.Id === id);
  if (!u) return;

  selectedId = id;

  // Update active highlight in list
  symbolListEl.querySelectorAll('li').forEach(li => {
    li.classList.toggle('active', li.dataset.id === id);
  });

  // Clear validation state
  clearValidationErrors();

  // Populate form fields
  fieldName.value               = u.Name;
  fieldId.value                 = u.Id;
  fieldBuiltIn.checked          = !!u.BuiltIn;
  fieldVariableType.value       = u.VariableType || 'I';
  fieldRequireInitializer.checked = !!u.RequireInitializer;
  fieldBuiltInVersion.value     = u.BuiltIntoVersion || '';
  fieldDescription.value        = u.Description || '';

  renderArgTable(u.InitializerArguments);

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

function showNotification(message) {
  const el = document.getElementById('notification');
  el.textContent = message;

  if (notificationTimer !== null) {
    clearTimeout(notificationTimer);
    notificationTimer = null;
  }
  el.className = '';
  void el.offsetWidth;

  el.className = 'show';

  notificationTimer = setTimeout(() => {
    el.className = 'hide';
    notificationTimer = setTimeout(() => {
      el.className = '';
      notificationTimer = null;
    }, 300);
  }, 2500);
}

// ============================================================
// Validation
// ============================================================

function setFieldError(inputEl, errorId, hasError) {
  const errorEl = document.getElementById(errorId);
  if (hasError) {
    inputEl.classList.add('input-error');
    errorEl.classList.add('visible');
  } else {
    inputEl.classList.remove('input-error');
    errorEl.classList.remove('visible');
  }
}

function clearValidationErrors() {
  setFieldError(fieldName, 'name-error', false);
  setFieldError(fieldBuiltInVersion, 'builtin-version-error', false);
}

function validateForm() {
  let valid = true;

  if (fieldName.value.trim() === '') {
    setFieldError(fieldName, 'name-error', true);
    valid = false;
  } else {
    setFieldError(fieldName, 'name-error', false);
  }

  if (fieldBuiltInVersion.value.trim() === '') {
    setFieldError(fieldBuiltInVersion, 'builtin-version-error', true);
    valid = false;
  } else {
    setFieldError(fieldBuiltInVersion, 'builtin-version-error', false);
  }

  return valid;
}

// ============================================================
// State Mutations
// ============================================================

function saveFormToState() {
  if (!selectedId) return;
  const u = uiTypes.find(u => u.Id === selectedId);
  if (!u) return;
  u.Name               = fieldName.value;
  u.BuiltIn            = fieldBuiltIn.checked;
  u.VariableType       = fieldVariableType.value;
  u.RequireInitializer = fieldRequireInitializer.checked;
  u.BuiltIntoVersion   = fieldBuiltInVersion.value;
  u.Description        = fieldDescription.value;
  // InitializerArguments are mutated in-place via openArgModal/deleteArg
}

function createUIType(name = '') {
  return {
    Id:                   crypto.randomUUID(),
    Name:                 name,
    BuiltIn:              true,
    VariableType:         'I',
    Description:          '',
    BuiltIntoVersion:     'N/A',
    RequireInitializer:   false,
    InitializerArguments: [],
  };
}

// ============================================================
// Argument CRUD
// ============================================================

function getCurrentUIType() {
  return uiTypes.find(u => u.Id === selectedId) || null;
}

function openArgModal(idx) {
  // idx = null → new argument, number → edit existing
  editingArgIndex = idx;

  // Clear validation in modal
  setFieldError(argFieldName, 'arg-name-error', false);
  setFieldError(argFieldDatatype, 'arg-datatype-error', false);

  if (idx === null) {
    argFieldName.value        = '';
    argFieldDatatype.value    = '';
    argFieldDescription.value = '';
  } else {
    const u = getCurrentUIType();
    if (!u) return;
    const arg = u.InitializerArguments[idx];
    argFieldName.value        = arg.Name || '';
    argFieldDatatype.value    = arg.DataType || '';
    argFieldDescription.value = arg.Description || '';
  }

  syncCheckboxes('qs-arg-datatype', argFieldDatatype.value);
  modalArgEdit.classList.add('open');
  argFieldName.focus();
}

function closeArgModal() {
  modalArgEdit.classList.remove('open');
  editingArgIndex = null;
}

function saveArg() {
  let valid = true;

  if (argFieldName.value.trim() === '') {
    setFieldError(argFieldName, 'arg-name-error', true);
    valid = false;
  } else {
    setFieldError(argFieldName, 'arg-name-error', false);
  }

  if (argFieldDatatype.value.trim() === '') {
    setFieldError(argFieldDatatype, 'arg-datatype-error', true);
    valid = false;
  } else {
    setFieldError(argFieldDatatype, 'arg-datatype-error', false);
  }

  if (!valid) return;

  const u = getCurrentUIType();
  if (!u) return;

  const arg = {
    Name:        argFieldName.value.trim(),
    DataType:    argFieldDatatype.value.trim(),
    Description: argFieldDescription.value,
  };

  if (editingArgIndex === null) {
    u.InitializerArguments.push(arg);
  } else {
    u.InitializerArguments[editingArgIndex] = arg;
  }

  closeArgModal();
  renderArgTable(u.InitializerArguments);
  showNotification(editingArgIndex === null ? 'Argument added' : 'Argument updated');
}

function deleteArg(idx) {
  const u = getCurrentUIType();
  if (!u) return;
  u.InitializerArguments.splice(idx, 1);
  renderArgTable(u.InitializerArguments);
  showNotification('Argument deleted');
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
      uiTypes = (parsed.Data || []).map(item => ({
        Id:                   item.Id                 || crypto.randomUUID(),
        Name:                 item.Name               || '',
        BuiltIn:              item.BuiltIn !== false,
        VariableType:         item.VariableType       || 'I',
        Description:          item.Description        || '',
        BuiltIntoVersion:     item.BuiltIntoVersion   || 'N/A',
        RequireInitializer:   item.RequireInitializer === true,
        InitializerArguments: (item.InitializerArguments || []).map(a => ({
          Name:        a.Name        || '',
          DataType:    a.DataType    || '',
          Description: a.Description || '',
        })),
      }));
      showPlaceholder();
      renderSymbolList();
      showNotification(`Loaded ${uiTypes.length} symbol(s)`);
    } catch (err) {
      alert('Failed to parse YAML:\n' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function handleExport() {
  const yaml = serializeYaml();
  const blob = new Blob([yaml], { type: 'text/yaml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'uitypes.yaml';
  a.click();
  URL.revokeObjectURL(url);
  showNotification('Exported');
}

function handleNewSymbol() {
  const u = createUIType();
  uiTypes.push(u);
  renderSymbolList();
  selectSymbol(u.Id);
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
  const idx = uiTypes.findIndex(u => u.Id === selectedId);
  if (idx === -1) return;
  uiTypes.splice(idx, 1);
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
    uiTypes.push(createUIType(name));
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

// Save / Delete
document.getElementById('btn-save').addEventListener('click', handleSave);
document.getElementById('btn-delete').addEventListener('click', handleDelete);

// Clear validation on input
fieldName.addEventListener('input', () => setFieldError(fieldName, 'name-error', false));
fieldBuiltInVersion.addEventListener('input', () => setFieldError(fieldBuiltInVersion, 'builtin-version-error', false));

// Search
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderSymbolList();
});

// Arguments
document.getElementById('btn-add-arg').addEventListener('click', () => openArgModal(null));
document.getElementById('btn-arg-save').addEventListener('click', saveArg);
document.getElementById('btn-arg-cancel').addEventListener('click', closeArgModal);
document.getElementById('btn-arg-close').addEventListener('click', closeArgModal);

// Bulk Import modal
document.getElementById('btn-bulk-cancel').addEventListener('click', handleBulkImportClose);
document.getElementById('btn-bulk-confirm').addEventListener('click', handleBulkImportConfirm);

// Close modals on backdrop click
modalBulkImport.addEventListener('click', (e) => {
  if (e.target === modalBulkImport) handleBulkImportClose();
});
modalArgEdit.addEventListener('click', (e) => {
  if (e.target === modalArgEdit) closeArgModal();
});

// Close modals with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalArgEdit.classList.contains('open')) {
      closeArgModal();
    } else if (modalBulkImport.classList.contains('open')) {
      handleBulkImportClose();
    }
  }
});

// Argument modal: clear validation on input
argFieldName.addEventListener('input', () => setFieldError(argFieldName, 'arg-name-error', false));
argFieldDatatype.addEventListener('input', () => {
  setFieldError(argFieldDatatype, 'arg-datatype-error', false);
  syncCheckboxes('qs-arg-datatype', argFieldDatatype.value);
});

// Initialize data type components
setupDataTypeComponent('arg-field-datatype', 'qs-arg-datatype');
