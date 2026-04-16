/**
 * taskmanager.js
 * Kanban Task Board — Chapter 3, Lab Exercise 2
 * Pure vanilla JS · No frameworks · No localStorage · No innerHTML for card building
 */

/* ═══════════════════════════════════════════════════
   STATE
   In-memory store for all tasks.
   Each task: { id, title, desc, priority, due, column }
═══════════════════════════════════════════════════ */
let tasks = [];        // Array of task objects
let nextId = 1;        // Auto-incrementing unique ID
let activeColumn = ''; // Tracks which column the open modal targets

/* ═══════════════════════════════════════════════════
   DOM REFERENCES
═══════════════════════════════════════════════════ */
const modalOverlay  = document.getElementById('modalOverlay');
const modalHeading  = document.getElementById('modalHeading');
const modalSaveBtn  = document.getElementById('modalSaveBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');

const titleInput    = document.getElementById('taskTitle');
const descInput     = document.getElementById('taskDesc');
const priorityInput = document.getElementById('taskPriority');
const dueInput      = document.getElementById('taskDue');
const editTaskId    = document.getElementById('editTaskId');
const editColumnId  = document.getElementById('editColumnId');

const priorityFilter = document.getElementById('priorityFilter');
const taskCounter    = document.getElementById('taskCounter');
const clearDoneBtn   = document.getElementById('clearDoneBtn');

// Column task-lists, keyed by column id
const columnLists = {
  todo:       document.getElementById('list-todo'),
  inprogress: document.getElementById('list-inprogress'),
  done:       document.getElementById('list-done'),
};

// Column count badges
const columnCounts = {
  todo:       document.getElementById('count-todo'),
  inprogress: document.getElementById('count-inprogress'),
  done:       document.getElementById('count-done'),
};

/* ═══════════════════════════════════════════════════
   HELPER — Format a YYYY-MM-DD date string for display
═══════════════════════════════════════════════════ */
function formatDate(dateStr) {
  if (!dateStr) return '';
  // Parse without timezone shift by splitting manually
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════
   HELPER — Check if a due date is in the past
═══════════════════════════════════════════════════ */
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-');
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

/* ═══════════════════════════════════════════════════
   TASK 2 — createTaskCard(taskObj)
   Builds a <li> card entirely via DOM API — no innerHTML.
   Returns the fully assembled element.
═══════════════════════════════════════════════════ */
function createTaskCard(taskObj) {

  /* ── Outer <li> ── */
  const li = document.createElement('li');
  li.setAttribute('data-id', taskObj.id);
  li.setAttribute('data-priority', taskObj.priority);
  li.classList.add('task-card');

  /* ── Title row (title + action buttons) ── */
  const titleRow = document.createElement('div');
  titleRow.classList.add('task-title-row');

  // Clickable title span — double-click triggers inline edit
  const titleSpan = document.createElement('span');
  titleSpan.classList.add('task-title');
  titleSpan.textContent = taskObj.title;
  titleSpan.title = 'Double-click to rename';

  // Attach double-click inline-edit listener (Task 3)
  titleSpan.addEventListener('dblclick', function () {
    startInlineEdit(li, titleSpan, taskObj.id);
  });

  // Action buttons wrapper
  const actions = document.createElement('div');
  actions.classList.add('task-actions');

  // Edit button — data-action used by event delegation
  const editBtn = document.createElement('button');
  editBtn.classList.add('task-btn', 'task-btn-edit');
  editBtn.setAttribute('data-action', 'edit');
  editBtn.setAttribute('data-id', taskObj.id);
  editBtn.setAttribute('aria-label', 'Edit task');
  editBtn.textContent = 'Edit';

  // Delete button — data-action used by event delegation
  const delBtn = document.createElement('button');
  delBtn.classList.add('task-btn', 'task-btn-delete');
  delBtn.setAttribute('data-action', 'delete');
  delBtn.setAttribute('data-id', taskObj.id);
  delBtn.setAttribute('aria-label', 'Delete task');
  delBtn.textContent = 'Del';

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  titleRow.appendChild(titleSpan);
  titleRow.appendChild(actions);

  /* ── Description ── */
  if (taskObj.desc && taskObj.desc.trim()) {
    const descP = document.createElement('p');
    descP.classList.add('task-desc');
    descP.textContent = taskObj.desc;
    li.appendChild(titleRow);
    li.appendChild(descP);
  } else {
    li.appendChild(titleRow);
  }

  /* ── Meta row (priority badge + due date) ── */
  const meta = document.createElement('div');
  meta.classList.add('task-meta');

  // Priority badge
  const badge = document.createElement('span');
  badge.classList.add('priority-badge', 'priority-' + taskObj.priority);
  badge.textContent = taskObj.priority.charAt(0).toUpperCase() + taskObj.priority.slice(1);

  meta.appendChild(badge);

  // Due date (optional)
  if (taskObj.due) {
    const dueSpan = document.createElement('span');
    dueSpan.classList.add('task-due');
    if (isOverdue(taskObj.due)) {
      dueSpan.classList.add('overdue');
    }
    dueSpan.textContent = '📅 ' + formatDate(taskObj.due);
    meta.appendChild(dueSpan);
  }

  li.appendChild(meta);

  // Apply filter visibility immediately after creation
  applyFilterToCard(li, priorityFilter.value);

  return li;
}

/* ═══════════════════════════════════════════════════
   TASK 2 — addTask(columnId, taskObj)
   Appends a new card to the correct column <ul>
   and updates the task counter.
═══════════════════════════════════════════════════ */
function addTask(columnId, taskObj) {
  // Store the task in our in-memory array
  tasks.push(taskObj);

  // Build and insert the card
  const card = createTaskCard(taskObj);
  const list = columnLists[columnId];
  list.appendChild(card);

  // Update column count and global counter
  updateCounters();
}

/* ═══════════════════════════════════════════════════
   TASK 2 — deleteTask(taskId)
   Adds CSS fade-out, removes element after animation,
   and removes the task from the tasks array.
═══════════════════════════════════════════════════ */
function deleteTask(taskId) {
  const card = document.querySelector('[data-id="' + taskId + '"]');
  if (!card) return;

  // Add animation class
  card.classList.add('is-removing');

  // Remove from DOM and array after animation ends (280ms, matches CSS)
  card.addEventListener('animationend', function () {
    card.remove();
    // Remove from tasks array
    tasks = tasks.filter(function (t) { return t.id !== taskId; });
    updateCounters();
  }, { once: true });
}

/* ═══════════════════════════════════════════════════
   TASK 2 — editTask(taskId)
   Opens the modal pre-filled with the task's current data.
═══════════════════════════════════════════════════ */
function editTask(taskId) {
  const task = tasks.find(function (t) { return t.id === taskId; });
  if (!task) return;

  // Pre-fill modal fields
  titleInput.value    = task.title;
  descInput.value     = task.desc || '';
  priorityInput.value = task.priority;
  dueInput.value      = task.due || '';

  // Store IDs so Save knows we're editing
  editTaskId.value    = taskId;
  editColumnId.value  = task.column;

  // Update modal heading
  modalHeading.textContent = 'Edit Task';
  activeColumn = task.column;

  openModal();
}

/* ═══════════════════════════════════════════════════
   TASK 2 — updateTask(taskId, updatedData)
   Updates the task object in the array and refreshes
   the matching card's DOM content in-place.
═══════════════════════════════════════════════════ */
function updateTask(taskId, updatedData) {
  // Find and update the task in the array
  const idx = tasks.findIndex(function (t) { return t.id === taskId; });
  if (idx === -1) return;

  tasks[idx] = Object.assign({}, tasks[idx], updatedData);
  const task = tasks[idx];

  // Find the existing card in the DOM
  const oldCard = document.querySelector('[data-id="' + taskId + '"]');
  if (!oldCard) return;

  // Build a fresh card with updated data (same creation API, no innerHTML)
  const newCard = createTaskCard(task);

  // Swap old card with new card in the list
  oldCard.replaceWith(newCard);
}

/* ═══════════════════════════════════════════════════
   TASK 3 — INLINE EDITING
   Double-clicking a task title replaces it with an <input>.
   Enter key or blur commits the change.
═══════════════════════════════════════════════════ */
function startInlineEdit(card, titleSpan, taskId) {
  // Prevent opening more than one inline edit at a time
  if (card.querySelector('.task-title-input')) return;

  // Create an input element to replace the span
  const input = document.createElement('input');
  input.type = 'text';
  input.classList.add('task-title-input');
  input.value = titleSpan.textContent;
  input.maxLength = 80;

  // Replace the span with the input
  titleSpan.replaceWith(input);
  input.focus();
  input.select();

  // Commit the inline edit on Enter or blur
  function commitEdit() {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== '') {
      // Update the task object
      const idx = tasks.findIndex(function (t) { return t.id === taskId; });
      if (idx !== -1) tasks[idx].title = newTitle;

      // Update the span text and put it back
      titleSpan.textContent = newTitle;
    }
    // Restore the span (even if title was empty — keep old value)
    input.replaceWith(titleSpan);
  }

  // Enter key commits
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    }
    // Escape cancels (no change)
    if (e.key === 'Escape') {
      input.replaceWith(titleSpan);
    }
  });

  // Losing focus also commits
  input.addEventListener('blur', commitEdit, { once: true });
}

/* ═══════════════════════════════════════════════════
   TASK 3 — EVENT DELEGATION
   One click listener per column <ul> handles Edit and Delete.
═══════════════════════════════════════════════════ */
Object.values(columnLists).forEach(function (list) {
  list.addEventListener('click', function (event) {
    const action = event.target.getAttribute('data-action');
    const idStr  = event.target.getAttribute('data-id');
    if (!action || !idStr) return;  // Click was on something else

    const taskId = parseInt(idStr, 10);

    if (action === 'delete') { deleteTask(taskId); }
    if (action === 'edit')   { editTask(taskId);   }
  });
});

/* ═══════════════════════════════════════════════════
   TASK 3 — PRIORITY FILTER
   Hides non-matching cards using classList.toggle — not style.display.
═══════════════════════════════════════════════════ */
function applyFilterToCard(card, selectedPriority) {
  const cardPriority = card.getAttribute('data-priority');
  const shouldHide = selectedPriority !== 'all' && cardPriority !== selectedPriority;
  card.classList.toggle('is-hidden', shouldHide);
}

function applyFilterToAll(selectedPriority) {
  document.querySelectorAll('.task-card').forEach(function (card) {
    applyFilterToCard(card, selectedPriority);
  });
}

priorityFilter.addEventListener('change', function () {
  applyFilterToAll(priorityFilter.value);
});

/* ═══════════════════════════════════════════════════
   TASK 3 — CLEAR DONE with staggered fade-out
   Each card fades 100ms after the previous.
═══════════════════════════════════════════════════ */
clearDoneBtn.addEventListener('click', function () {
  const doneCards = Array.from(columnLists['done'].querySelectorAll('.task-card'));
  if (doneCards.length === 0) return;

  doneCards.forEach(function (card, index) {
    // Stagger: each card starts 100ms after the previous
    setTimeout(function () {
      card.classList.add('is-removing');
      card.addEventListener('animationend', function () {
        const taskId = parseInt(card.getAttribute('data-id'), 10);
        card.remove();
        tasks = tasks.filter(function (t) { return t.id !== taskId; });
        updateCounters();
      }, { once: true });
    }, index * 100);
  });
});

/* ═══════════════════════════════════════════════════
   MODAL — Open / Close helpers
═══════════════════════════════════════════════════ */
function openModal() {
  modalOverlay.classList.add('is-open');
  modalOverlay.setAttribute('aria-hidden', 'false');
  titleInput.focus();
}

function closeModal() {
  modalOverlay.classList.remove('is-open');
  modalOverlay.setAttribute('aria-hidden', 'true');
  clearModalForm();
}

function clearModalForm() {
  titleInput.value    = '';
  descInput.value     = '';
  priorityInput.value = 'medium';
  dueInput.value      = '';
  editTaskId.value    = '';
  editColumnId.value  = '';
  modalHeading.textContent = 'New Task';
}

// Close modal on overlay click (outside the modal box)
modalOverlay.addEventListener('click', function (e) {
  if (e.target === modalOverlay) closeModal();
});

// Close with Escape key
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && modalOverlay.classList.contains('is-open')) {
    closeModal();
  }
});

modalCancelBtn.addEventListener('click', closeModal);
modalCloseBtn.addEventListener('click', closeModal);

/* ═══════════════════════════════════════════════════
   MODAL — Save button handler
   Either creates a new task or updates an existing one.
═══════════════════════════════════════════════════ */
modalSaveBtn.addEventListener('click', function () {
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.focus();
    titleInput.style.borderColor = 'var(--high-color)';
    setTimeout(function () { titleInput.style.borderColor = ''; }, 1200);
    return;
  }

  const existingId = editTaskId.value ? parseInt(editTaskId.value, 10) : null;

  if (existingId) {
    // ── UPDATE existing task ──
    updateTask(existingId, {
      title:    title,
      desc:     descInput.value.trim(),
      priority: priorityInput.value,
      due:      dueInput.value,
    });
  } else {
    // ── CREATE new task ──
    const taskObj = {
      id:       nextId++,
      title:    title,
      desc:     descInput.value.trim(),
      priority: priorityInput.value,
      due:      dueInput.value,
      column:   activeColumn,
    };
    addTask(activeColumn, taskObj);
  }

  closeModal();
});

/* ═══════════════════════════════════════════════════
   "ADD TASK" BUTTONS — One per column
   Open the modal targeting the right column.
═══════════════════════════════════════════════════ */
document.querySelectorAll('.add-task-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    activeColumn = btn.getAttribute('data-column');
    editTaskId.value = '';
    editColumnId.value = activeColumn;
    modalHeading.textContent = 'New Task';
    clearModalForm();  // Reset fields for fresh entry
    openModal();
  });
});

/* ═══════════════════════════════════════════════════
   UPDATE COUNTERS
   Refreshes the global task count badge and each column badge.
═══════════════════════════════════════════════════ */
function updateCounters() {
  // Total tasks
  taskCounter.textContent = tasks.length;

  // Per-column counts from DOM (reliable even mid-animation)
  Object.keys(columnLists).forEach(function (col) {
    const count = columnLists[col].querySelectorAll('.task-card:not(.is-removing)').length;
    columnCounts[col].textContent = count;
  });
}

/* ═══════════════════════════════════════════════════
   SEED DATA — Preload a few example tasks on first load
   so the board isn't completely empty.
═══════════════════════════════════════════════════ */
function seedTasks() {
  const seeds = [
    { title: 'Design wireframes',        desc: 'Create lo-fi mockups for the new dashboard.',  priority: 'high',   due: '2026-04-20', column: 'todo' },
    { title: 'Write unit tests',          desc: 'Cover all CRUD functions in taskmanager.js.',  priority: 'medium', due: '2026-04-25', column: 'todo' },
    { title: 'Implement filter logic',    desc: 'Priority filter must use classList.toggle.',   priority: 'high',   due: '2026-04-18', column: 'inprogress' },
    { title: 'Style column headers',      desc: 'Add dots, counts, and clear button.',          priority: 'low',    due: '',           column: 'inprogress' },
    { title: 'Project kick-off meeting',  desc: 'Align team on scope and milestones.',          priority: 'medium', due: '2026-04-10', column: 'done' },
  ];

  seeds.forEach(function (seed) {
    const taskObj = Object.assign({ id: nextId++ }, seed);
    addTask(taskObj.column, taskObj);
  });
}

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
seedTasks();
updateCounters();
