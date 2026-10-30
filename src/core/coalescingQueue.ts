// Replace pending work for the same file while resolving every caller after it is applied.
export class CoalescingQueue {
  private jobs = new Map<
    string,
    {
      run: () => Promise<void>;
      waiters: Array<{ resolve: () => void; reject: (e: unknown) => void }>;
    }
  >();
  private timer?: NodeJS.Timeout;
  private draining?: Promise<void>;
  constructor(private delay = 25) {}
  enqueue(key: string, run: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const job = this.jobs.get(key);
      if (job) {
        job.run = run;
        job.waiters.push({ resolve, reject });
      } else this.jobs.set(key, { run, waiters: [{ resolve, reject }] });
      if (!this.timer && !this.draining)
        this.timer = setTimeout(() => {
          this.timer = undefined;
          void this.flush();
        }, this.delay);
    });
  }
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.draining) {
      await this.draining;
      if (this.jobs.size) await this.flush();
      return;
    }
    this.draining = (async () => {
      while (this.jobs.size) {
        const jobs = [...this.jobs.values()];
        this.jobs.clear();
        for (const job of jobs) {
          try {
            await job.run();
            job.waiters.forEach((w) => w.resolve());
          } catch (e) {
            job.waiters.forEach((w) => w.reject(e));
          }
        }
      }
    })();
    try {
      await this.draining;
    } finally {
      this.draining = undefined;
    }
  }
}
