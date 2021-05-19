'use strict';

const expect = require('expect');
const logParser = require('../');
const logFile = __dirname + '/fixtures/plot-log.txt';
const logFilePart = __dirname + '/fixtures/plot-log-unfinished.txt';

describe('Plot parser', () => {

	describe('parse()', () => {

		it('parses log file', async () => {
			const parser = logParser(logFile);
			const res = await parser.parse();

			expect(res.modified).toBeInstanceOf(Date);
			expect(res.created).toBeInstanceOf(Date);
			delete res.created;
			delete res.modified;

			expect(res).toEqual({
				tmpDirs: ['/foobar', '/foobar'],
				id: '1553a1f4a9bb4d36a8a81e4334854c36d8abec1f192c362a28bd935fb035a03c',
				plotSize: 32,
				bufferSize: 3390,
				buckets: 128,
				threads: 2,
				stripeSize: 65536,
				phase1: {
					startTime: new Date('2021-05-08T09:38:18.000Z'),
					seconds: 9998.132,
					cpuPercent: 145.15,
					endTime: new Date('2021-05-08T12:24:56.000Z')
				},
				phase2: {
					startTime: new Date('2021-05-08T12:24:56.000Z'),
					seconds: 4188.688,
					cpuPercent: 98.23,
					endTime: new Date('2021-05-08T13:34:45.000Z')
				},
				phase3: {
					startTime: new Date('2021-05-08T13:34:45.000Z'),
					seconds: 7607.997,
					cpuPercent: 98.21,
					endTime: new Date('2021-05-08T15:41:33.000Z')
				},
				phase4: {
					startTime: new Date('2021-05-08T15:41:33.000Z'),
					seconds: 552.296,
					cpuPercent: 99.46,
					endTime: new Date('2021-05-08T15:50:45.000Z')
				},
				finalFileSize: 101.42,
				totalTimeSeconds: 22347.115,
				cpu: 119.24,
				finishedTime: new Date('2021-05-08T15:50:45.000Z'),
				copyTimeSeconds: 152.474,
				copyCpu: 75.12,
				copyFinishedTime: new Date('2021-05-08T15:53:19.000Z')
			});
		});

		it('parses non finished file', async () => {
			const parser = logParser(logFilePart);
			const res = await parser.parse();

			expect(res.modified).toBeInstanceOf(Date);
			expect(res.created).toBeInstanceOf(Date);
			delete res.created;
			delete res.modified;
			expect(res).toEqual({
				tmpDirs: ['/foobar', '/foobar'],
				id: '1553a1f4a9bb4d36a8a81e4334854c36d8abec1f192c362a28bd935fb035a03c',
				plotSize: 32,
				bufferSize: 3390,
				buckets: 128,
				threads: 2,
				stripeSize: 65536,
				phase1: {startTime: new Date('2021-05-08T09:38:18.000Z')}
			});
		});

	});

	describe('start()', () => {

		it('emits events', (done) => {
			const parser = logParser(logFile);
			const events = {
				phaseStart: 0,
				phaseEnd: 0,
				error: 0,
				started: 0,
				finished: 0,
				done: 0,
				progress: 0
			};

			Object.keys(events).forEach((event) => {
				parser.on(event, (...args) => {
					events[event]++;
					if (event === 'done') {
						expect(events).toEqual({
							phaseStart: 4,
							phaseEnd: 4,
							error: 0,
							started: 1,
							finished: 1,
							done: 1,
							progress: 19
						});
						done();
					}
				});
			});

			parser.start();
		});

		it('emits parseEnd for non finished log file', (done) => {
			const parser = logParser(logFilePart);
			parser.on('parseEnd', (data) => {
				delete data.created;
				delete data.modified;

				expect(data).toEqual({
					tmpDirs: ['/foobar', '/foobar'],
					id: '1553a1f4a9bb4d36a8a81e4334854c36d8abec1f192c362a28bd935fb035a03c',
					plotSize: 32,
					bufferSize: 3390,
					buckets: 128,
					threads: 2,
					stripeSize: 65536,
					phase1: {startTime: new Date('2021-05-08T09:38:18.000Z')}
				});
				done();
			});

			parser.start();
		});

		it('emits error if file is not readable', (done) => {
			const parser = logParser('.');
			parser.on('error', (err) => {
				expect(err.message).toEqual('EISDIR: illegal operation on a directory, read');
				done();
			});

			parser.start();
		});
	});
});
