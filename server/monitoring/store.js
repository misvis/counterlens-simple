import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const percentile = (sortedValues, proportion) => {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * proportion) - 1);
  return sortedValues[index];
};

export class MonitoringStore {
  constructor({ databasePath, retentionDays = 30, now = () => Date.now() }) {
    if (databasePath !== ':memory:') {
      fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    }

    this.now = now;
    this.retentionDays = retentionDays;
    this.database = new Database(databasePath);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('foreign_keys = ON');
    this.writeCount = 0;

    this.database.exec(`
      CREATE TABLE IF NOT EXISTS product_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at INTEGER NOT NULL,
        name TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        dataset_version TEXT NOT NULL,
        policy_id TEXT,
        locale TEXT,
        theme TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_product_events_recorded_at
        ON product_events(recorded_at);

      CREATE TABLE IF NOT EXISTS request_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at INTEGER NOT NULL,
        route TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        duration_ms REAL NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_request_metrics_recorded_at
        ON request_metrics(recorded_at);
    `);

    this.insertEvent = this.database.prepare(`
      INSERT INTO product_events (
        recorded_at, name, dataset_id, dataset_version, policy_id, locale, theme
      ) VALUES (
        @recordedAt, @name, @datasetId, @datasetVersion, @policyId, @locale, @theme
      )
    `);
    this.insertRequest = this.database.prepare(`
      INSERT INTO request_metrics (
        recorded_at, route, method, status_code, duration_ms
      ) VALUES (
        @recordedAt, @route, @method, @statusCode, @durationMs
      )
    `);
    this.cleanup();
  }

  maybeCleanup() {
    this.writeCount += 1;
    if (this.writeCount >= 500) {
      this.cleanup();
      this.writeCount = 0;
    }
  }

  recordEvent(event) {
    this.insertEvent.run({
      recordedAt: this.now(),
      name: event.name,
      datasetId: event.datasetId,
      datasetVersion: event.datasetVersion,
      policyId: event.policyId ?? null,
      locale: event.locale ?? null,
      theme: event.theme ?? null,
    });
    this.maybeCleanup();
  }

  recordRequest(metric) {
    this.insertRequest.run({
      recordedAt: this.now(),
      route: metric.route,
      method: metric.method,
      statusCode: metric.statusCode,
      durationMs: Number(metric.durationMs.toFixed(2)),
    });
    this.maybeCleanup();
  }

  cleanup() {
    const cutoff = this.now() - this.retentionDays * DAY_MS;
    this.database.prepare('DELETE FROM product_events WHERE recorded_at < ?').run(cutoff);
    this.database.prepare('DELETE FROM request_metrics WHERE recorded_at < ?').run(cutoff);
  }

  getSummary({ windowHours = 24, datasetQuality }) {
    const since = this.now() - windowHours * HOUR_MS;
    const requestRows = this.database.prepare(`
      SELECT route, method, status_code AS statusCode, duration_ms AS durationMs
      FROM request_metrics
      WHERE recorded_at >= ?
    `).all(since);
    const eventRows = this.database.prepare(`
      SELECT name, COUNT(*) AS count
      FROM product_events
      WHERE recorded_at >= ?
      GROUP BY name
      ORDER BY count DESC, name ASC
    `).all(since);
    const routeRows = this.database.prepare(`
      SELECT
        route,
        method,
        COUNT(*) AS requests,
        SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS serverErrors,
        ROUND(AVG(duration_ms), 2) AS averageDurationMs
      FROM request_metrics
      WHERE recorded_at >= ?
      GROUP BY route, method
      ORDER BY requests DESC, route ASC
    `).all(since);
    const hourlyRows = this.database.prepare(`
      SELECT
        strftime('%Y-%m-%dT%H:00:00Z', recorded_at / 1000, 'unixepoch') AS hour,
        COUNT(*) AS requests
      FROM request_metrics
      WHERE recorded_at >= ?
      GROUP BY hour
      ORDER BY hour ASC
    `).all(since);

    const durations = requestRows
      .map((row) => row.durationMs)
      .sort((left, right) => left - right);
    const serverErrors = requestRows.filter((row) => row.statusCode >= 500).length;
    const clientErrors = requestRows.filter((row) => row.statusCode >= 400 && row.statusCode < 500).length;
    const averageDurationMs = durations.length
      ? durations.reduce((total, duration) => total + duration, 0) / durations.length
      : 0;

    return {
      generatedAt: new Date(this.now()).toISOString(),
      windowHours,
      retentionDays: this.retentionDays,
      service: {
        requests: requestRows.length,
        clientErrors,
        serverErrors,
        serverErrorRate: requestRows.length
          ? Number(((serverErrors / requestRows.length) * 100).toFixed(2))
          : 0,
        averageDurationMs: Number(averageDurationMs.toFixed(2)),
        p95DurationMs: Number(percentile(durations, 0.95).toFixed(2)),
      },
      events: {
        total: eventRows.reduce((total, row) => total + row.count, 0),
        counts: eventRows,
      },
      routes: routeRows,
      hourlyTraffic: hourlyRows,
      dataset: datasetQuality,
      privacy: {
        storesIpAddresses: false,
        storesUserAgents: false,
        storesStudentRecordIds: false,
        storesReflectionText: false,
        measuresUniquePeople: false,
      },
    };
  }

  close() {
    this.database.close();
  }
}

export const createMonitoringStore = (options) => new MonitoringStore(options);
