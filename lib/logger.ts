// Structured logger — writes to console + optionally Supabase cron_logs table.
// Use in all cron jobs for health monitoring.

type LogLevel = "info" | "warn" | "error";

interface LogMeta {
  cron_name?: string;
  [key: string]: unknown;
}

export function log(level: LogLevel, message: string, meta: LogMeta = {}): void {
  const prefix = `[${level.toUpperCase()}]${meta.cron_name ? ` [${meta.cron_name}]` : ""}`;
  if (level === "error") {
    console.error(prefix, message, Object.keys(meta).length > 1 ? meta : "");
  } else if (level === "warn") {
    console.warn(prefix, message, Object.keys(meta).length > 1 ? meta : "");
  } else {
    console.log(prefix, message, Object.keys(meta).length > 1 ? meta : "");
  }
}

// ── Cron execution wrapper ────────────────────────────────────────────────────
// Usage:
//   const run = cronRunner("storm-check");
//   const logId = await run.start();
//   ... do work ...
//   await run.finish(logId, { leadsGenerated: 3 });

export interface CronRunner {
  start(): Promise<string | null>;
  finish(logId: string | null, opts?: { leadsGenerated?: number; actionsCount?: number; metadata?: Record<string, unknown>; error?: string }): Promise<void>;
}

export function cronRunner(cronName: string): CronRunner {
  const startedAt = new Date().toISOString();

  return {
    async start(): Promise<string | null> {
      log("info", `Starting`, { cron_name: cronName });
      if (!process.env.SUPABASE_URL) return null;
      try {
        const { getSupabase } = await import("@/lib/supabase");
        const { data } = await getSupabase()
          .from("cron_logs")
          .insert({ cron_name: cronName, started_at: startedAt })
          .select("id")
          .single();
        return data?.id || null;
      } catch {
        return null;
      }
    },

    async finish(logId: string | null, opts = {}): Promise<void> {
      const finishedAt = new Date().toISOString();
      const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
      const result = opts.error ? "error" : "success";

      log(result === "error" ? "error" : "info", `Finished (${durationMs}ms)`, {
        cron_name: cronName,
        leads_generated: opts.leadsGenerated,
        error: opts.error,
      });

      if (!logId || !process.env.SUPABASE_URL) return;
      try {
        const { getSupabase } = await import("@/lib/supabase");
        await getSupabase()
          .from("cron_logs")
          .update({
            finished_at: finishedAt,
            duration_ms: durationMs,
            result,
            error: opts.error || null,
            leads_generated: opts.leadsGenerated || 0,
            actions_taken: opts.actionsCount || 0,
            metadata: opts.metadata || null,
          })
          .eq("id", logId);
      } catch {}
    },
  };
}
