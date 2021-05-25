'use strict';

const expect = require('expect');
const harvester = require('../src/harvester');
const logFile = __dirname + '/fixtures/harvest-log.txt';

describe('Harvest parser', () => {

	describe('parse()', () => {

		it('parses log file', async () => {
			const parser = harvester(logFile);
			const res = await parser.parse();
			expect(res).toEqual({
				signagePoint: [{
					timestamp: new Date('2021-05-22T15:38:49.837'),
					eligible: 1,
					hash: '486436f706',
					proofs: 0,
					duration: 0.07757,
					plots: 66
				}, {
					timestamp: new Date('2021-05-22T15:39:06.358'),
					eligible: 0,
					hash: '486436f706',
					proofs: 0,
					duration: 0.00668,
					plots: 66
				}, {
					timestamp: new Date('2021-05-22T15:39:06.967'),
					eligible: 0,
					hash: '486436f706',
					proofs: 0,
					duration: 0.00504,
					plots: 66
				}],
				warning: [{
					timestamp: new Date('2021-05-21T09:11:48.229'),
					message: 'Directory: /Volumes/foobar/plots does not exist.'
				}, {
					timestamp: new Date('2021-05-22T11:00:22.259'),
					message: 'Looking up qualities on /Volumes/foobar/plots/plot-k32-2021-05-15-13-47-aff22113d6bbe9d1a37be3ee7ccb295d083085ff93a1942b1ccfbe7ffa41e5d4.plot took: 6.22216010093689. This should be below 5 seconds to minimize risk of losing rewards.'
				}],
				load: [{
					plots: 66,
					size: 6.532919835822213,
					sizeUnit: 'TiB',
					time: 0.08295607566833496,
					timestamp: new Date('2021-05-22T15:37:57.822')
				}]
			});
		});

	});

	describe('watch()', () => {

		it('emits events', (done) => {
			const parser = harvester(logFile);
			const events = {
				signagePoint: 0,
				warning: 0,
				load: 0
			};

			Object.keys(events).forEach((event) => {
				parser.on(event, (...args) => {
					events[event]++;
				});
			});

			parser.once('endParse', () => {
				parser.stop();
				expect(events).toEqual({
					warning: 2,
					signagePoint: 3,
					load: 1
				});
				done();
			});

			parser.watch(0).catch(done);
		});

	});
});
