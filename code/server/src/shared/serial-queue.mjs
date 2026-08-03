/**
 * 轻量进程内串行队列。前一个任务失败不会阻断后续任务，
 * 适用于控制文件写入和截图序号分配这两类临界区。
 */
export class SerialQueue {
  #tail = Promise.resolve();

  run(task) {
    const result = this.#tail.then(task, task);
    this.#tail = result.catch(() => undefined);
    return result;
  }
}
