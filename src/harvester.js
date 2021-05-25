'use strict';

const fs = require('fs');
const EventEmitter = require('events');
const TailFile = require('@logdna/tail-file');
const split2 = require('split2');
const {mapFilterValues} = require('./lib/filter');

const filters = [{
	regexp: /^([^\s]+) harvester chia.harvester.harvester: INFO\s+(\d+) plots were eligible for farming ([^\.]+)\.\.\. Found (\d+) proofs. Time: (\d+\.\d+) s. Total (\d+) plots/,
	values: [['timestamp', (d) => new Date(d)], ['eligible', Number], 'hash', ['proofs', Number], ['duration', Number], ['plots', Number]],
	event: 'signagePoint'
}, {
	regexp: /^([^\s]+) harvester [^:]+: WARNING\s+([^$]+)/,
	values: [['timestamp', (d) => new Date(d)], 'message'],
	event: 'warning'
}, {
	regexp: /^([^\s]+) harvester [^:]+: INFO\s+Loaded a total of (\d+) plots of size (\d+(\.\d+)?) ([^,]+), in (\d+(\.\d+)?)/,
	values: [['timestamp', (d) => new Date(d)], ['plots', Number], ['size', Number],, 'sizeUnit', ['time', Number]],
	event: 'load'
}];

class HarvestParser extends EventEmitter {
	constructor(file) {
		super();
		this.file = file;
		this.isWatching = false;
	}

	async watch(startPos) {
		if (this.isWatching) {
			throw new Error('Watch is already running');
		}

		this.tail = new TailFile(this.file, {startPos});
		this.tail.on('tail_error', (err) => {
			this.emit('error', err);
		});

		this.tail.on('error', (err) => {
			this.emit('error', err);
		});

		this.tail.on('flush', () => {
			this.emit('endParse');
		});

		await this.tail.start();
		this.isWatching = true;
		this.tail
			.pipe(split2())
			.on('data', (line) => this.onLine(line));
	}

	stop() {
		this.tail.quit();
		this.isWatching = false;
	}

	parse() {
		let resolve, reject, error;
		const promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});

		const result = {
			signagePoint: [],
			warning: [],
			load: []
		};

		const onError = (err) => {
			error = err;
		};

		const update = (event) => (data) => result[event].push(data);
		const updateEligable = update('signagePoint');
		const updateWarning = update('warning');
		const updateLoad = update('load');

		const done = () => {
			this.off('signagePoint', updateEligable);
			this.off('warning', updateWarning);
			this.off('load', updateLoad);
			this.off('error', onError);
			if (error) {
				return reject(error);
			}

			resolve(result);
		};

		this.on('signagePoint', updateEligable);
		this.on('warning', updateWarning);
		this.on('load', updateLoad);
		this.on('error', onError);
		fs.createReadStream(this.file)
			.on('error', (err) => {
				error = err;
			})
			.pipe(split2())
			.on('error', (err) => {
				error = err;
			})
			.on('data', (line) => this.onLine(line))
			.on('end', done);

		return promise;
	}

	onLine(line) {
		let matches;
		const filter = filters.find((f) => {
			matches = f.regexp.exec(line);
			return matches;
		});

		if (!matches) {
			return;
		}

		const data = mapFilterValues(filter.values, matches, {});
		if (filter.event) {
			this.emit(filter.event, data);
		}
	}
}

module.exports = (file) => {
	return new HarvestParser(file);
};

module.exports.HarvestParser = HarvestParser;
