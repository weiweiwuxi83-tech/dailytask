const BACKUP_PREFIX = "dailytask.tasks.";
const BACKUP_FORMAT = "dailytask-backup";

const backupFileInput = document.querySelector("#backup-file");
const exportButton = document.querySelector("#export-backup");
const importButton = document.querySelector("#import-backup");

function getSavedDays() {
  const days = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(BACKUP_PREFIX)) continue;

    try {
      const tasks = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(tasks)) {
        days[key.slice(BACKUP_PREFIX.length)] = tasks;
      }
    } catch {
      // 跳过格式异常的数据，不修改原数据。
    }
  }

  return days;
}

function exportBackup() {
  const days = getSavedDays();
  const backup = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    days,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `dailytask-backup-${new Date().toLocaleDateString("en-CA")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  alert("备份已导出。请在 Safari 的下载或分享菜单中选择“存储到文件”，保存到 iCloud Drive。");
}

function isValidTask(task) {
  return Boolean(
    task &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.completed === "boolean" &&
    ["life", "work", "study"].includes(task.category) &&
    (task.details === undefined || Array.isArray(task.details))
  );
}

function readBackup(data) {
  if (
    !data ||
    data.format !== BACKUP_FORMAT ||
    data.version !== 1 ||
    !data.days ||
    typeof data.days !== "object" ||
    Array.isArray(data.days)
  ) {
    throw new Error("这不是有效的 DailyTask 备份文件。");
  }

  const days = {};

  for (const [date, tasks] of Object.entries(data.days)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Array.isArray(tasks) ||
      !tasks.every(isValidTask)
    ) {
      throw new Error("备份文件内容格式不正确，未导入数据。");
    }

    days[date] = tasks;
  }

  return days;
}

function importBackup(file) {
  if (file.size > 50 * 1024 * 1024) {
    alert("备份文件超过 50 MB，暂不支持导入。");
    return;
  }

  const reader = new FileReader();

  reader.onerror = () => {
    alert("读取备份文件失败，请重新选择。");
  };

  reader.onload = () => {
    try {
      const days = readBackup(JSON.parse(reader.result));
      const dateCount = Object.keys(days).length;

      if (dateCount === 0) {
        alert("这个备份文件中没有任务数据。");
        return;
      }

      if (!confirm(`备份包含 ${dateCount} 天的数据。导入会与本机数据合并；相同任务以备份内容为准。继续吗？`)) {
        return;
      }

      for (const [date, importedTasks] of Object.entries(days)) {
        const key = BACKUP_PREFIX + date;
        let existingTasks = [];

        try {
          const saved = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(saved)) existingTasks = saved.filter(isValidTask);
        } catch {
          existingTasks = [];
        }

        const merged = new Map(existingTasks.map((task) => [task.id, task]));
        importedTasks.forEach((task) => merged.set(task.id, task));

        localStorage.setItem(key, JSON.stringify([...merged.values()]));
      }

      alert("导入成功，页面将刷新显示恢复的任务。");
      window.location.reload();
    } catch (error) {
      const message = error instanceof SyntaxError
        ? "无法读取这个 JSON 文件，请选择 DailyTask 导出的备份。"
        : error.message || "导入失败，可能是浏览器存储空间不足。";
      alert(message);
    } finally {
      backupFileInput.value = "";
    }
  };

  reader.readAsText(file);
}

exportButton.addEventListener("click", exportBackup);
importButton.addEventListener("click", () => backupFileInput.click());

backupFileInput.addEventListener("change", () => {
  const file = backupFileInput.files && backupFileInput.files[0];
  if (file) importBackup(file);
});
