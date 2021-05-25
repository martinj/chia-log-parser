'use strict';
const fs = require('fs');
const EventEmitter = require('events');
const split2 = require('split2');
const TailFile = require('@logdna/tail-file');
const {mapFilterValues} = require('./lib/filter');

class FileParser extends EventEmitter {
	constructor(file) {
		super();
		this.file = file;
		this.isWatching = false;
	}

	parse() {
		return new Promise((resolve, reject) => {
			function error(err) {
				this.off('parseEnd', done);
				reject(err);
			}

			function done(data) {
				this.off('error', error);
				resolve(data);
			}

			this.once('error', error);
			this.once('parseEnd', done);
			this.start();
		});
	}

	async watch() {
		if (this.isWatching) {
			throw new Error('Watch is already running');
		}

		this.reset();
		try {
			await this.onStart();
		} catch (err) {
			this.emit('error', err);
			return;
		}

		this.tail = new TailFile(this.file, {startPos: 0});
		this.tail.on('tail_error', (err) => {
			this.emit('error', err);
		});

		this.tail.on('error', (err) => {
			this.emit('error', err);
		});

		await this.tail.start();
		this.isWatching = true;
		this.tail.pipe(split2()).on('data', (line) => {
			this.emit('line', line);
			if (this.isFinished()) {
				this.tail.quit();
				this.emit('done', this.data);
			}
		});
	}

	async start() {
		this.reset();

		try {
			await this.onStart();
		} catch (err) {
			this.emit('error', err);
			return;
		}

		fs.createReadStream(this.file)
			.on('error', (err) => this.emit('error', err))
			.pipe(split2())
			.on('error', (err) => this.emit('error', err))
			.on('data', (line) => {
				this.emit('line', line);
			})
			.on('end', () => {
				this.emit('parseEnd', this.data);
				if (this.isFinished()) {
					this.emit('done', this.data);
				}
			});
	}

	reset() {
		this.data = {};
	}

	onStart() {
		throw new Error('not implemented');
	}

	isFinished() {
		throw new Error('not implemented');
	}

	onFilter(filter, match, data) {
		mapFilterValues(filter.values, match, data);

		if (filter.event) {
			this.emit(filter.event, data);
		}
	}

}

module.exports = FileParser;
