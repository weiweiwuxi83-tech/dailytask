const STORAGE_KEY = `dailytask.tasks.${new Date().toLocaleDateString("en-CA")}`;
const categories = {
  life: { label: "生活", className: "life" },
  work: { label: "工作", className: "work" },
  study: { label: "学习", className: "study" },
};

const form = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const categoryInput = document.querySelector("#task-category");
const list = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const taskCount = document.querySelector("#task-count");
const progressPercent = document.querySelector("#progress-percent");
const progressSummary = document.querySelector("#progress-summary");
const progressFill = document.querySelector("#progress-fill");
const progressTrack = document.querySelector(".progress-track");
const clearCompletedButton = document.querySelector("#clear-completed");
const filterButtons = [...document.querySelectorAll(".filter-button")];

let tasks = loadTasks();
let currentFilter = "all";
const expandedTasks = new Set();

function loadTasks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((task) => task && typeof task.id === "string" && typeof task.title === "string" && typeof task.completed === "boolean" && categories[task.category])
      .map((task) => ({
        ...task,
        details: Array.isArray(task.details) ? task.details.filter((detail) => detail && ["text", "image", "table"].includes(detail.type)) : [],
      }));
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    alert("浏览器存储空间不足，请删除一些图片或清理空间后重试。");
    return false;
  }
}

function updateTask(id, updater) {
  tasks = tasks.map((task) => task.id === id ? updater(task) : task);
  return saveTasks();
}

function createButton(className, label, text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Canvas unavailable"));
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderDetail(task, detail, detailIndex) {
  const block = document.createElement("div");
  block.className = `detail-block detail-${detail.type}`;
  const header = document.createElement("div");
  header.className = "detail-block-header";
  const label = document.createElement("span");
  label.className = "detail-block-label";
  label.textContent = { text: "文字备注", image: "图片", table: "表格" }[detail.type];
  header.append(label, createButton("remove-detail", "删除这项内容", "删除", () => {
    updateTask(task.id, (item) => ({ ...item, details: item.details.filter((_, index) => index !== detailIndex) }));
    render();
  }));
  block.append(header);

  if (detail.type === "text") {
    const textarea = document.createElement("textarea");
    textarea.className = "detail-textarea";
    textarea.rows = 3;
    textarea.placeholder = "写下补充说明、链接或灵感…";
    textarea.value = detail.text || "";
    textarea.setAttribute("aria-label", "任务文字备注");
    textarea.addEventListener("input", () => {
      updateTask(task.id, (item) => ({
        ...item,
        details: item.details.map((part, index) => index === detailIndex ? { ...part, text: textarea.value } : part),
      }));
      saveHint.textContent = "内容已自动保存；编辑完成后可点下方按钮收起。";
    });

    const saveHint = document.createElement("p");
    saveHint.className = "detail-save-hint";
    saveHint.textContent = "编辑完成后，点“保存并收起”结束编辑。";
    const actions = document.createElement("div");
    actions.className = "detail-save-actions";
    actions.append(createButton("detail-save-button", "保存文字备注并收起详情", "保存并收起", () => {
      const saved = updateTask(task.id, (item) => ({
        ...item,
        details: item.details.map((part, index) => index === detailIndex ? { ...part, text: textarea.value } : part),
      }));
      if (!saved) return;
      expandedTasks.delete(task.id);
      render();
    }));
    block.append(textarea, saveHint, actions);
  } else if (detail.type === "image") {
    if (detail.src) {
      const image = document.createElement("img");
      image.className = "detail-image";
      image.src = detail.src;
      image.alt = detail.name || "任务图片";
      block.append(image);
    } else {
      const note = document.createElement("p");
      note.className = "image-placeholder";
      note.textContent = "图片尚未添加。";
      block.append(note);
    }
  } else {
    const rows = Array.isArray(detail.rows) && detail.rows.length ? detail.rows : [["", ""], ["", ""]];
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "detail-table";
    const tbody = document.createElement("tbody");
    rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      (Array.isArray(row) ? row : [""]).forEach((value, colIndex) => {
        const td = document.createElement("td");
        const cell = document.createElement("input");
        cell.type = "text";
        cell.value = typeof value === "string" ? value : "";
        cell.setAttribute("aria-label", `表格第${rowIndex + 1}行第${colIndex + 1}列`);
        cell.addEventListener("input", () => updateTask(task.id, (item) => ({
          ...item,
          details: item.details.map((part, index) => {
            if (index !== detailIndex) return part;
            const nextRows = part.rows.map((r) => [...r]);
            nextRows[rowIndex][colIndex] = cell.value;
            return { ...part, rows: nextRows };
          }),
        })));
        td.append(cell);
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    const actions = document.createElement("div");
    actions.className = "table-actions";
    actions.append(
      createButton("table-action", "添加表格行", "+ 添加一行", () => {
        updateTask(task.id, (item) => ({
          ...item,
          details: item.details.map((part, index) => index === detailIndex ? {
            ...part,
            rows: [...part.rows, Array(part.rows[0]?.length || 2).fill("")],
          } : part),
        }));
        render();
      }),
      createButton("table-action", "添加表格列", "+ 添加一列", () => {
        updateTask(task.id, (item) => ({
          ...item,
          details: item.details.map((part, index) => index === detailIndex ? {
            ...part,
            rows: part.rows.map((row) => [...row, ""]),
          } : part),
        }));
        render();
      })
    );
    block.append(wrap, actions);
  }
  return block;
}

function renderTask(task) {
  const item = document.createElement("li");
  item.className = `task-item${task.completed ? " is-completed" : ""}`;
  const main = document.createElement("div");
  main.className = "task-main";
  const checkbox = createButton("task-check", task.completed ? "标记为未完成" : "完成任务", "✓", () => {
    updateTask(task.id, (entry) => ({ ...entry, completed: !entry.completed }));
    render();
  });
  checkbox.setAttribute("role", "checkbox");
  checkbox.setAttribute("aria-checked", String(task.completed));
  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;
  const badge = document.createElement("span");
  badge.className = `category-badge ${categories[task.category].className}`;
  badge.textContent = categories[task.category].label;
  const isOpen = expandedTasks.has(task.id);
  const toggle = createButton(`detail-toggle${isOpen ? " is-open" : ""}`, isOpen ? "收起补充内容" : "展开补充内容", `▾ ${task.details.length ? `补充内容 ${task.details.length}` : "补充内容"}`, () => {
    if (expandedTasks.has(task.id)) expandedTasks.delete(task.id);
    else expandedTasks.add(task.id);
    render();
  });
  toggle.setAttribute("aria-expanded", String(isOpen));
  const remove = createButton("delete-button", `删除任务：${task.title}`, "×", () => {
    tasks = tasks.filter((entry) => entry.id !== task.id);
    expandedTasks.delete(task.id);
    saveTasks();
    render();
  });
  main.append(checkbox, title, badge, toggle, remove);
  item.append(main);

  if (isOpen) {
    const panel = document.createElement("div");
    panel.className = "task-details";
    const toolbar = document.createElement("div");
    toolbar.className = "detail-toolbar";
    toolbar.append(createButton("detail-add-button", "添加文字备注", "+ 文字", () => {
      updateTask(task.id, (entry) => ({ ...entry, details: [...entry.details, { type: "text", text: "" }] }));
      render();
    }));
    const imageLabel = document.createElement("label");
    imageLabel.className = "detail-add-button file-label";
    imageLabel.textContent = "+ 图片";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.setAttribute("aria-label", "添加图片");
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) return alert("请选择图片文件。");
      if (file.size > 12 * 1024 * 1024) return alert("图片不能超过 12 MB。");
      try {
        const src = await compressImage(file);
        updateTask(task.id, (entry) => ({ ...entry, details: [...entry.details, { type: "image", src, name: file.name }] }));
        render();
      } catch {
        alert("无法读取图片，请重试。");
      }
    });
    imageLabel.append(fileInput);
    toolbar.append(imageLabel, createButton("detail-add-button", "添加表格", "+ 表格", () => {
      updateTask(task.id, (entry) => ({ ...entry, details: [...entry.details, { type: "table", rows: [["", ""], ["", ""]] }] }));
      render();
    }));
    panel.append(toolbar);
    task.details.forEach((detail, index) => panel.append(renderDetail(task, detail, index)));
    item.append(panel);
  }
  return item;
}

function render() {
  const completed = tasks.filter((task) => task.completed).length;
  const total = tasks.length;
  const percent = total ? Math.round(completed / total * 100) : 0;
  const visible = tasks.filter((task) => currentFilter === "active" ? !task.completed : currentFilter === "completed" ? task.completed : true);
  list.replaceChildren(...visible.map(renderTask));
  taskCount.textContent = String(total);
  progressPercent.textContent = `${percent}%`;
  progressSummary.textContent = total ? `已完成 ${completed} / ${total} 项` : "还没有任务";
  progressFill.style.width = `${percent}%`;
  progressTrack.setAttribute("aria-valuenow", String(percent));
  emptyState.hidden = visible.length > 0;
  emptyState.classList.toggle("is-filtered", total > 0 && visible.length === 0);
  clearCompletedButton.hidden = completed === 0;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    return;
  }
  tasks.unshift({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    category: categories[categoryInput.value] ? categoryInput.value : "life",
    completed: false,
    details: [],
  });
  saveTasks();
  currentFilter = "all";
  filterButtons.forEach((button) => {
    const selected = button.dataset.filter === currentFilter;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  form.reset();
  taskInput.focus();
  render();
});

filterButtons.forEach((button) => button.addEventListener("click", () => {
  currentFilter = button.dataset.filter;
  filterButtons.forEach((item) => {
    const selected = item === button;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  render();
}));

clearCompletedButton.addEventListener("click", () => {
  tasks = tasks.filter((task) => !task.completed);
  saveTasks();
  render();
});

render();
