const taskStore = new Map<string, any>();

const TTL_MS = 5 * 60 * 1000; // 5 minutes

// Auto-cleanup expired tasks every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of taskStore) {
    if (now - value._created > TTL_MS) taskStore.delete(key);
  }
}, 60000);

export async function createTask(taskId: string, data: object): Promise<void> {
  taskStore.set(taskId, { ...data, _created: Date.now() });
}

export async function getTask(taskId: string): Promise<any | null> {
  const task = taskStore.get(taskId);
  if (!task) return null;
  if (Date.now() - task._created > TTL_MS) {
    taskStore.delete(taskId);
    return null;
  }
  return task;
}

export async function deleteTask(taskId: string): Promise<void> {
  taskStore.delete(taskId);
}
