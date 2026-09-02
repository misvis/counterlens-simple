export const monitoringPage = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CounterLens Monitor</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #172033;
        background: #f4f7fb;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #f4f7fb; }
      button, input, select { font: inherit; }
      .shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 48px; }
      header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 22px; }
      .eyebrow { color: #9a6700; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      h1 { margin: 5px 0 4px; font-size: clamp(28px, 4vw, 42px); letter-spacing: -.04em; }
      .subtitle, .fine-print { color: #536078; line-height: 1.55; }
      .status { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #ccd6e5; border-radius: 999px; background: #fff; padding: 8px 12px; font-size: 13px; font-weight: 700; }
      .dot { width: 9px; height: 9px; border-radius: 50%; background: #94a3b8; }
      .dot.ok { background: #059669; box-shadow: 0 0 0 4px #d1fae5; }
      .panel { border: 1px solid #dce3ee; border-radius: 18px; background: #fff; box-shadow: 0 12px 30px rgba(39, 54, 82, .07); }
      .access { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; padding: 16px; margin-bottom: 18px; }
      label { display: grid; gap: 6px; color: #46536b; font-size: 12px; font-weight: 800; }
      input, select { min-height: 40px; border: 1px solid #b9c6d8; border-radius: 10px; background: #fff; color: #172033; padding: 8px 11px; outline: none; }
      input { width: min(340px, 76vw); }
      input:focus, select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px #dbeafe; }
      button { min-height: 40px; border: 0; border-radius: 10px; background: #2457d6; color: #fff; padding: 9px 15px; font-weight: 800; cursor: pointer; }
      button:hover { background: #1746bf; }
      button.secondary { border: 1px solid #b9c6d8; background: #fff; color: #27344c; }
      button.secondary:hover { background: #f2f5fa; }
      .message { min-height: 20px; color: #b42318; font-size: 13px; font-weight: 700; }
      .toolbar { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; margin: 18px 0 12px; }
      .updated { color: #64748b; font-size: 12px; }
      .cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
      .card { padding: 16px; }
      .card-label { color: #64748b; font-size: 12px; font-weight: 750; }
      .card-value { margin-top: 5px; font-size: 27px; font-weight: 850; letter-spacing: -.03em; }
      .card-note { margin-top: 5px; color: #728096; font-size: 11px; }
      .grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 14px; margin-top: 14px; }
      .section { padding: 18px; }
      h2 { margin: 0 0 4px; font-size: 17px; }
      .section-description { margin: 0 0 14px; color: #64748b; font-size: 12px; line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { padding: 9px 7px; border-bottom: 1px solid #edf1f6; text-align: left; }
      th { color: #64748b; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
      td.number, th.number { text-align: right; font-variant-numeric: tabular-nums; }
      .empty { color: #7a879b; padding: 18px 0; text-align: center; }
      .traffic { display: flex; min-height: 118px; align-items: end; gap: 4px; margin-top: 12px; }
      .bar-wrap { display: flex; min-width: 5px; flex: 1; height: 105px; align-items: end; }
      .bar { width: 100%; min-height: 2px; border-radius: 4px 4px 1px 1px; background: linear-gradient(180deg, #4f7de8, #2457d6); }
      .quality-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
      .quality-item { border-radius: 12px; background: #f5f8fc; padding: 10px; }
      .quality-item strong { display: block; margin-top: 3px; font-size: 18px; }
      .privacy { margin-top: 14px; border: 1px solid #b7e3d1; border-radius: 14px; background: #effaf5; padding: 14px; color: #176246; font-size: 12px; line-height: 1.55; }
      [hidden] { display: none !important; }
      @media (max-width: 900px) {
        .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 560px) {
        header { flex-direction: column; }
        .cards { grid-template-columns: 1fr; }
        .quality-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header>
        <div>
          <div class="eyebrow">CounterLens · privacy-first operations</div>
          <h1>System Monitor</h1>
          <div class="subtitle">Anonymous traffic, interaction signals, and dataset quality—without student records or reflection text.</div>
        </div>
        <div class="status"><span id="health-dot" class="dot"></span><span id="health-text">Checking API…</span></div>
      </header>

      <form id="access-form" class="panel access">
        <label>
          Monitoring token
          <input id="token" type="password" autocomplete="off" placeholder="Enter the server monitoring token" required />
        </label>
        <button type="submit">Open monitor</button>
        <div id="message" class="message" role="alert"></div>
      </form>

      <section id="dashboard" hidden>
        <div class="toolbar">
          <label>
            Time window
            <select id="window">
              <option value="24">Last 24 hours</option>
              <option value="72">Last 3 days</option>
              <option value="168">Last 7 days</option>
            </select>
          </label>
          <div>
            <span id="updated" class="updated"></span>
            <button id="refresh" class="secondary" type="button">Refresh</button>
          </div>
        </div>

        <div class="cards">
          <article class="panel card"><div class="card-label">Requests</div><div id="requests" class="card-value">0</div><div class="card-note">API calls, not unique people</div></article>
          <article class="panel card"><div class="card-label">Page views</div><div id="page-views" class="card-value">0</div><div class="card-note">Anonymous count</div></article>
          <article class="panel card"><div class="card-label">Server error rate</div><div id="error-rate" class="card-value">0%</div><div class="card-note">HTTP 5xx responses</div></article>
          <article class="panel card"><div class="card-label">Average latency</div><div id="average-latency" class="card-value">0 ms</div><div class="card-note">Across monitored routes</div></article>
          <article class="panel card"><div class="card-label">P95 latency</div><div id="p95-latency" class="card-value">0 ms</div><div class="card-note">95% complete within this time</div></article>
        </div>

        <div class="grid">
          <section class="panel section">
            <h2>Traffic over time</h2>
            <p class="section-description">Hourly request volume. Rate limiting may reject abusive event traffic.</p>
            <div id="traffic" class="traffic"></div>
          </section>
          <section class="panel section">
            <h2>Teaching interactions</h2>
            <p class="section-description">Only allow-listed, content-free events are accepted.</p>
            <table><thead><tr><th>Event</th><th class="number">Count</th></tr></thead><tbody id="events"></tbody></table>
          </section>
          <section class="panel section">
            <h2>API routes</h2>
            <p class="section-description">Volume, server errors, and mean response time by route.</p>
            <table><thead><tr><th>Route</th><th class="number">Calls</th><th class="number">5xx</th><th class="number">Avg ms</th></tr></thead><tbody id="routes"></tbody></table>
          </section>
          <section class="panel section">
            <h2>Dataset release</h2>
            <p class="section-description">Schema-level checks for the currently published classroom view.</p>
            <div class="quality-grid">
              <div class="quality-item">Status<strong id="dataset-status">—</strong></div>
              <div class="quality-item">Records<strong id="dataset-records">—</strong></div>
              <div class="quality-item">Features<strong id="dataset-features">—</strong></div>
            </div>
            <table><thead><tr><th>Feature</th><th class="number">Missing</th><th class="number">Out of range</th></tr></thead><tbody id="quality"></tbody></table>
          </section>
        </div>

        <div class="privacy">
          <strong>Privacy boundary:</strong> this monitor deliberately does not store IP addresses, user agents, student record IDs, reflection text, or unique-person identifiers. Counts are operational and educational signals, not audited user counts.
        </div>
      </section>
    </main>
    <script>
      (function () {
        'use strict';
        var monitoringToken = '';
        var accessForm = document.getElementById('access-form');
        var dashboard = document.getElementById('dashboard');
        var message = document.getElementById('message');

        function setText(id, value) {
          document.getElementById(id).textContent = String(value);
        }

        function emptyRow(messageText, columns) {
          var row = document.createElement('tr');
          var cell = document.createElement('td');
          cell.colSpan = columns;
          cell.className = 'empty';
          cell.textContent = messageText;
          row.appendChild(cell);
          return row;
        }

        function renderTable(bodyId, rows, columns, renderRow) {
          var body = document.getElementById(bodyId);
          body.replaceChildren();
          if (!rows.length) {
            body.appendChild(emptyRow('No data in this window', columns));
            return;
          }
          rows.forEach(function (entry) { body.appendChild(renderRow(entry)); });
        }

        function cell(value, numeric) {
          var element = document.createElement('td');
          if (numeric) element.className = 'number';
          element.textContent = String(value);
          return element;
        }

        function renderTraffic(rows) {
          var container = document.getElementById('traffic');
          container.replaceChildren();
          if (!rows.length) {
            var empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No traffic in this window';
            container.appendChild(empty);
            return;
          }
          var maximum = Math.max.apply(null, rows.map(function (row) { return row.requests; }));
          rows.forEach(function (row) {
            var wrapper = document.createElement('div');
            wrapper.className = 'bar-wrap';
            wrapper.title = row.hour + ': ' + row.requests + ' requests';
            var bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = Math.max(2, Math.round((row.requests / maximum) * 100)) + '%';
            wrapper.appendChild(bar);
            container.appendChild(wrapper);
          });
        }

        function renderSummary(summary) {
          var eventMap = Object.fromEntries(summary.events.counts.map(function (row) { return [row.name, row.count]; }));
          setText('requests', summary.service.requests);
          setText('page-views', eventMap.page_view || 0);
          setText('error-rate', summary.service.serverErrorRate + '%');
          setText('average-latency', summary.service.averageDurationMs + ' ms');
          setText('p95-latency', summary.service.p95DurationMs + ' ms');
          setText('updated', 'Updated ' + new Date(summary.generatedAt).toLocaleString());
          setText('dataset-status', summary.dataset.status);
          setText('dataset-records', summary.dataset.recordCount);
          setText('dataset-features', summary.dataset.featureCount);
          renderTraffic(summary.hourlyTraffic);

          renderTable('events', summary.events.counts, 2, function (entry) {
            var row = document.createElement('tr');
            row.appendChild(cell(entry.name.replaceAll('_', ' '), false));
            row.appendChild(cell(entry.count, true));
            return row;
          });

          renderTable('routes', summary.routes, 4, function (entry) {
            var row = document.createElement('tr');
            row.appendChild(cell(entry.method + ' ' + entry.route, false));
            row.appendChild(cell(entry.requests, true));
            row.appendChild(cell(entry.serverErrors, true));
            row.appendChild(cell(entry.averageDurationMs, true));
            return row;
          });

          var features = Object.keys(summary.dataset.missingValues);
          renderTable('quality', features, 3, function (feature) {
            var row = document.createElement('tr');
            row.appendChild(cell(feature, false));
            row.appendChild(cell(summary.dataset.missingValues[feature], true));
            row.appendChild(cell(summary.dataset.outOfRangeValues[feature], true));
            return row;
          });
        }

        async function loadSummary() {
          message.textContent = '';
          var hours = document.getElementById('window').value;
          var response = await fetch('/api/v1/monitoring/summary?windowHours=' + encodeURIComponent(hours), {
            headers: { Authorization: 'Bearer ' + monitoringToken },
            cache: 'no-store'
          });
          if (!response.ok) {
            var body = await response.json().catch(function () { return {}; });
            throw new Error(body.message || 'Unable to load monitoring data');
          }
          renderSummary(await response.json());
          dashboard.hidden = false;
        }

        accessForm.addEventListener('submit', async function (event) {
          event.preventDefault();
          monitoringToken = document.getElementById('token').value;
          try {
            await loadSummary();
            document.getElementById('token').value = '';
          } catch (error) {
            dashboard.hidden = true;
            message.textContent = error.message;
          }
        });

        document.getElementById('refresh').addEventListener('click', function () {
          loadSummary().catch(function (error) { message.textContent = error.message; });
        });
        document.getElementById('window').addEventListener('change', function () {
          loadSummary().catch(function (error) { message.textContent = error.message; });
        });

        fetch('/healthz', { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error();
            document.getElementById('health-dot').classList.add('ok');
            setText('health-text', 'API healthy');
          })
          .catch(function () { setText('health-text', 'API unavailable'); });
      }());
    </script>
  </body>
</html>`;
