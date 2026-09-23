import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createSyntheticClassroomView } from '../../shared/classroomDataset.js';
import { DEMO_QUESTIONNAIRE } from '../../shared/questionnaire.js';
import {
  validateClassroomView,
  summarizeDatasetQuality,
} from '../datasets/registry.js';

const HOUR = 3600000;
const round = (value) => Math.round((value || 0) * 100) / 100;

export class ClassroomStore {
  constructor(client, db, retentionDays) {
    this.client = client;
    this.db = db;
    this.retentionDays = retentionDays;
  }

  async initialize() {
    await Promise.all([
      this.db
        .collection('classroom_records')
        .createIndex({ releaseId: 1, id: 1 }, { unique: true }),
      this.db
        .collection('events')
        .createIndex({ classroomId: 1, recordedAt: 1 }),
      this.db
        .collection('events')
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.db.collection('request_metrics').createIndex({ recordedAt: 1 }),
      this.db
        .collection('request_metrics')
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.db
        .collection('responses')
        .createIndex({ classroomId: 1, submissionId: 1 }, { unique: true }),
      this.db
        .collection('responses')
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]);
    const view = validateClassroomView(createSyntheticClassroomView());
    const releaseId = `${view.dataset.id}:${view.dataset.version}`;
    // Publish metadata only after all records have been seeded successfully.
    await this.db.collection('classroom_records').bulkWrite(
      view.records.map((record) => ({
        updateOne: {
          filter: { releaseId, id: record.id },
          update: { $setOnInsert: { releaseId, ...record } },
          upsert: true,
        },
      })),
    );
    const metadata = { ...view };
    delete metadata.records;
    await this.db.collection('dataset_releases').updateOne(
      { _id: releaseId },
      {
        $setOnInsert: { ...metadata, published: true, createdAt: new Date() },
      },
      { upsert: true },
    );
    await this.db.collection('questionnaires').updateOne(
      { _id: `${DEMO_QUESTIONNAIRE.id}:${DEMO_QUESTIONNAIRE.version}` },
      {
        $setOnInsert: DEMO_QUESTIONNAIRE,
      },
      { upsert: true },
    );
    await this.db.collection('classrooms').updateOne(
      { _id: 'local-demo' },
      {
        $setOnInsert: {
          title: 'Local classroom demo',
          releaseId,
          status: 'open',
          synthetic: false,
          questionnaireId: `${DEMO_QUESTIONNAIRE.id}:${DEMO_QUESTIONNAIRE.version}`,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  async ping() {
    const started = performance.now();
    await this.db.command({ ping: 1 });
    return { status: 'ok', latencyMs: round(performance.now() - started) };
  }

  async getView(datasetId) {
    const release = await this.db
      .collection('dataset_releases')
      .findOne(
        { 'dataset.id': datasetId, published: true },
        { sort: { createdAt: -1 } },
      );
    return release ? this.getRelease(release._id) : null;
  }

  async getRelease(releaseId) {
    const release = await this.db
      .collection('dataset_releases')
      .findOne({ _id: releaseId, published: true });
    if (!release) return null;
    const view = { ...release };
    delete view._id;
    delete view.published;
    delete view.createdAt;
    const records = await this.db
      .collection('classroom_records')
      .find({ releaseId }, { projection: { _id: 0, releaseId: 0 } })
      .sort({ id: 1 })
      .toArray();
    return validateClassroomView({ ...view, records });
  }

  async getClassroom(id) {
    const classroom = await this.db
      .collection('classrooms')
      .findOne({ _id: id });
    if (!classroom) return null;
    const questionnaire = await this.db
      .collection('questionnaires')
      .findOne({ _id: classroom.questionnaireId }, { projection: { _id: 0 } });
    return {
      id: classroom._id,
      title: classroom.title,
      status: classroom.status,
      synthetic: classroom.synthetic,
      releaseId: classroom.releaseId,
      questionnaire,
    };
  }

  async listClassrooms() {
    return this.db
      .collection('classrooms')
      .find(
        {},
        { projection: { title: 1, status: 1, synthetic: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
  }

  async createClassroom(title, synthetic = false) {
    const id = `${synthetic ? 'showcase' : 'class'}-${randomUUID().slice(0, 8)}`;
    await this.db.collection('classrooms').insertOne({
      _id: id,
      title,
      status: 'open',
      synthetic,
      createdAt: new Date(),
      releaseId: 'admissions-demo:synthetic-1973-v1',
      questionnaireId: `${DEMO_QUESTIONNAIRE.id}:${DEMO_QUESTIONNAIRE.version}`,
    });
    return this.getClassroom(id);
  }

  async setClassroomStatus(id, status) {
    const result = await this.db
      .collection('classrooms')
      .updateOne({ _id: id }, { $set: { status } });
    return result.matchedCount > 0;
  }

  expiry() {
    return new Date(Date.now() + this.retentionDays * 24 * HOUR);
  }
  async recordEvent(event) {
    await this.db
      .collection('events')
      .insertOne({
        ...event,
        recordedAt: new Date(),
        expiresAt: this.expiry(),
      });
  }
  async recordRequest(metric) {
    await this.db
      .collection('request_metrics')
      .insertOne({
        ...metric,
        durationMs: round(metric.durationMs),
        recordedAt: new Date(),
        expiresAt: this.expiry(),
      });
  }
  async recordResponse(response) {
    const result = await this.db
      .collection('responses')
      .updateOne(
        {
          classroomId: response.classroomId,
          submissionId: response.submissionId,
        },
        {
          $setOnInsert: {
            ...response,
            recordedAt: new Date(),
            expiresAt: this.expiry(),
          },
        },
        { upsert: true },
      );
    return result.upsertedCount > 0;
  }

  async seedShowcase() {
    const classroom = await this.createClassroom(
      'Illustrative classroom · 24 demo responses',
      true,
    );
    const names = [
      'page_view',
      'policy_selected',
      'student_selected',
      'borderline_cases_opened',
      'counterfactual_flipped',
      'policy_selected',
      'student_selected',
      'policy_selected',
    ];
    await this.db.collection('events').insertMany(
      Array.from({ length: 186 }, (_, i) => ({
        classroomId: classroom.id,
        name: names[i % names.length],
        datasetId: 'admissions-demo',
        datasetVersion: 'synthetic-1973-v1',
        policyId: ['academic', 'holistic', 'opportunity'][i % 3],
        locale: 'en',
        theme: 'light',
        synthetic: true,
        recordedAt: new Date(Date.now() - Math.pow((185 - i) / 185, 1.8) * 5.5 * HOUR),
        expiresAt: this.expiry(),
      })),
    );
    await this.db.collection('responses').insertMany(
      Array.from({ length: 24 }, (_, i) => ({
        classroomId: classroom.id,
        submissionId: randomUUID(),
        synthetic: true,
        questionnaireId: DEMO_QUESTIONNAIRE.id,
        questionnaireVersion: DEMO_QUESTIONNAIRE.version,
        releaseId: classroom.releaseId,
        locale: 'en',
        consent: true,
        answers: {
          policy: i < 12 ? 'holistic' : i < 20 ? 'opportunity' : 'academic',
          confidence: i < 2 ? 2 : i < 7 ? 3 : i < 18 ? 4 : 5,
          reflection: [
            'I would ask who benefits from the cutoff.',
            'A higher admission rate does not answer every fairness question.',
            'I would compare similar students under each policy.',
          ][i % 3],
        },
        recordedAt: new Date(Date.now() - (23 - i) * 45000),
        expiresAt: this.expiry(),
      })),
    );
    return classroom;
  }

  async getSummary({ windowHours = 24, classroomId = 'local-demo' }) {
    const since = new Date(Date.now() - windowHours * HOUR);
    const metricMatch = {
      recordedAt: { $gte: since },
      expiresAt: { $gt: new Date() },
    };
    const classMatch = { ...metricMatch, classroomId };
    const metrics = this.db.collection('request_metrics');
    const events = this.db.collection('events');
    const responses = this.db.collection('responses');
    const grouped = (collection, field) =>
      collection
        .aggregate([
          { $match: classMatch },
          { $group: { _id: `$${field}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray();
    const [
      serviceRows,
      routes,
      hourlyTraffic,
      counts,
      policies,
      answerChoices,
      confidence,
      responseCount,
      recentResponses,
      recentEvents,
      classroom,
      database,
    ] = await Promise.all([
      metrics
        .aggregate([
          { $match: metricMatch },
          {
            $group: {
              _id: null,
              requests: { $sum: 1 },
              serverErrors: {
                $sum: { $cond: [{ $gte: ['$statusCode', 500] }, 1, 0] },
              },
              clientErrors: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$statusCode', 400] },
                        { $lt: ['$statusCode', 500] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              averageDurationMs: { $avg: '$durationMs' },
              p95: {
                $percentile: {
                  input: '$durationMs',
                  p: [0.95],
                  method: 'approximate',
                },
              },
            },
          },
        ])
        .toArray(),
      metrics
        .aggregate([
          { $match: metricMatch },
          {
            $group: {
              _id: { route: '$route', method: '$method' },
              requests: { $sum: 1 },
              errors: {
                $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] },
              },
              duration: { $avg: '$durationMs' },
            },
          },
          { $sort: { requests: -1 } },
        ])
        .toArray(),
      events
        .aggregate([
          { $match: classMatch },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%dT%H:00:00Z',
                  date: '$recordedAt',
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),
      grouped(events, 'name'),
      events
        .aggregate([
          { $match: { ...classMatch, name: 'policy_selected' } },
          { $group: { _id: '$policyId', count: { $sum: 1 } } },
        ])
        .toArray(),
      grouped(responses, 'answers.policy'),
      grouped(responses, 'answers.confidence'),
      responses.countDocuments(classMatch),
      responses
        .find(classMatch, {
          projection: {
            _id: 0,
            answers: 1,
            recordedAt: 1,
            questionnaireVersion: 1,
            synthetic: 1,
          },
        })
        .sort({ recordedAt: -1 })
        .limit(12)
        .toArray(),
      events
        .find(classMatch, {
          projection: { _id: 0, name: 1, policyId: 1, recordedAt: 1 },
        })
        .sort({ recordedAt: -1 })
        .limit(8)
        .toArray(),
      this.getClassroom(classroomId),
      this.ping(),
    ]);
    const raw = serviceRows[0] || {};
    const view = classroom ? await this.getRelease(classroom.releaseId) : null;
    const service = {
      requests: raw.requests || 0,
      serverErrors: raw.serverErrors || 0,
      clientErrors: raw.clientErrors || 0,
      serverErrorRate: round(
        ((raw.serverErrors || 0) / (raw.requests || 1)) * 100,
      ),
      averageDurationMs: round(raw.averageDurationMs),
      p95DurationMs: round(raw.p95?.[0]),
      p95Approximate: true,
    };
    const mapCounts = (rows) =>
      rows
        .filter((row) => row._id != null)
        .map((row) => ({ name: String(row._id), count: row.count }));
    return {
      generatedAt: new Date(),
      windowHours,
      retentionDays: this.retentionDays,
      classroom,
      service,
      database,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: round(process.memoryUsage().rss / 1024 / 1024),
      events: {
        counts: mapCounts(counts),
        total: counts.reduce((n, row) => n + row.count, 0),
        policies: mapCounts(policies),
        recent: recentEvents,
      },
      hourlyTraffic: hourlyTraffic.map((row) => ({
        hour: row._id,
        events: row.count,
      })),
      surveys: {
        count: responseCount,
        choices: mapCounts(answerChoices),
        confidence: mapCounts(confidence),
        recent: recentResponses,
      },
      routes: routes.map((row) => ({
        ...row._id,
        requests: row.requests,
        errors: row.errors,
        averageDurationMs: round(row.duration),
      })),
      dataset: view ? summarizeDatasetQuality(view) : null,
      privacy: {
        storesIpAddresses: false,
        storesStudentRecordIds: false,
        storesSubmittedAnswers: true,
        measuresUniquePeople: false,
      },
    };
  }

  async close() {
    await this.client.close();
  }
}

export const createClassroomStore = async ({
  mongoUri,
  mongoDbName,
  monitoringRetentionDays,
}) => {
  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 2500,
    connectTimeoutMS: 2500,
    socketTimeoutMS: 5000,
    maxPoolSize: 10,
  });
  try {
    await client.connect();
    const store = new ClassroomStore(
      client,
      client.db(mongoDbName),
      monitoringRetentionDays,
    );
    await store.initialize();
    return store;
  } catch (error) {
    await client.close();
    throw error;
  }
};
