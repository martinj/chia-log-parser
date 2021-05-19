'use strict';
const fs = require('fs');
const {stat: fsStat} = fs.promises;
const EventEmitter = require('events');
const {parse: parseDate} = require('date-fns');
const LineByLineReader = require('line-by-line');

const startPlot = [
	{
		regexp: /Starting plotting progress into temporary dirs: ([^\s]+) and ([^\s]+)/,
		values: [['tmpDirs'], ['tmpDirs']]
	},
	{
		regexp: /ID: ([^\s]+)/,
		values: ['id']
	},
	{
		regexp: /Plot size is: (\d+)/,
		values: [['plotSize', Number]]
	},
	{
		regexp: /Buffer size is: (\d+)/,
		values: [['bufferSize', Number]]
	},
	{
		regexp: /Using (\d+) buckets/,
		values: [['buckets', Number]]
	},
	{
		event: 'started',
		regexp: /Using (\d+) threads of stripe size (\d+)/,
		values: [['threads', Number], ['stripeSize', Number]]
	}
];

const endPlot = [
	{
		regexp: /Final File size: (\d+(\.\d+)?)/,
		values: [['finalFileSize', Number]]
	},
	{
		regexp: /Total time = (\d+(\.\d+)?) seconds. CPU \((\d+(\.\d+)?)%\) ([^$]+)/,
		values: [['totalTimeSeconds', Number],, ['cpu', Number],, ['finishedTime', stringToDate]]
	},
	{
		event: 'finished',
		regexp: /Copy time = (\d+(\.\d+)?) seconds. CPU \((\d+(\.\d+)?)%\) ([^$]+)/,
		values: [['copyTimeSeconds', Number],, ['copyCpu', Number],, ['copyFinishedTime', stringToDate]]
	}
];

const startPhase = /Starting phase (\d+)\/(\d+): .*?\.\.\.\s([^$]+)/;
const endPhase = /Time for phase (\d+) = (\d+(\.\d+)?) seconds. CPU \((\d+(\.\d+)?)%\) ([^$]+)/;

const progess = [
	[/Computing table (\d+)/, [1, 6, 12, 20, 28, 36, 42]],
	[/Backpropagating on table (\d+)/, [63, 61, 58, 55, 51, 48, 43]],
	[/Compressing tables (\d+)/, [66, 73, 79, 85, 92, 98]]
];

function stringToDate(str) {
	return parseDate(str, 'EEE MMM  d HH:mm:ss yyyy', new Date());
}

class Parser extends EventEmitter {
	constructor(file) {
		super();
		this.file = file;
	}

	parse() {
		return new Promise((resolve, reject) => {
			function error(err) {
				this.off('done', done);
				reject(err);
			}

			function done(data) {
				this.off('reject', done);
				resolve(data);
			}

			this.once('error', error);
			this.once('parseEnd', done);
			this.start();
		});
	}

	watch() {
		let watcher;

		const onParseEnd = () => {
			if (this.finished || watcher) {
				return;
			}

			watcher = fs.watch(this.file, (event) => {
				this.start(this.endByte);
			});
		};

		this.start(this.endByte);
		this.on('parseEnd', onParseEnd);
		this.on('done', () => {
			this.off('parseEnd', onParseEnd);
			watcher && watcher.close();
		});
	}

	async start(startByte) {
		let fileStat;
		try {
			fileStat = await fsStat(this.file);
		} catch (err) {
			this.emit('error', err);
			return;
		}

		if (!startByte) {
			this.startIndex = 0;
			this.endIndex = 0;
			this.endByte = 0;
			this.currentPhase = 0;
			this.data = {
				created: fileStat.birthtime
			};
			this.started = false;
			this.finished = false;
		}

		this.data.modified = fileStat.mtime;

		const lr = new LineByLineReader(this.file, {skipEmptyLines: true, start: startByte});

		lr.on('error', (err) => this.emit('error', err));

		lr.on('line', (line) => this.onNewLine(line));

		lr.on('end', () => {
			this.emit('parseEnd', this.data);
			if (this.finished) {
				this.emit('done', this.data);
			}
		});
	}

	onNewLine(line) {
		if (!line.length || this.finished) {
			return;
		}

		this.endByte += line.length;

		if (!this.started) {
			const stage = startPlot[this.startIndex];
			const match = stage.regexp.exec(line);
			if (match) {
				this.startIndex++;
				this.onData(stage, [...match]);
				this.started = stage.event === 'started';
			}
			return;
		}

		this.checkForPhase(line);

		if (this.currentPhase && progess[this.currentPhase - 1]) {
			this.checkPhaseProgress(line, progess[this.currentPhase - 1]);
		}

		if (this.data.phase4?.endTime) {
			const stage = endPlot[this.endIndex];
			const match = stage.regexp.exec(line);
			if (match) {
				this.endIndex++;
				this.onData(stage, [...match]);
				this.finished = stage.event === 'finished';
			}
		}
	}

	onData(stage, match) {
		stage.values.forEach((v, idx) => {
			if (v === undefined) {
				return;
			}

			if (Array.isArray(v)) {
				const [key, fn] = v;


				if (fn) {
					this.data[key] = fn(match[idx + 1]);
					return;
				}

				if (!this.data[key]) {
					this.data[key] = [];
				}

				this.data[key].push(match[idx + 1]);
				return;
			}

			if (typeof (v) === 'function') {
				Object.assign(this.data, v(match[idx + 1]));
				return;
			}

			this.data[v] = match[idx + 1];
		});


		if (stage.event) {
			this.emit(stage.event, this.data);
		}
	}

	checkForPhase(line) {
		const start = startPhase.exec(line);
		if (start) {
			const phase = this.currentPhase = start[1];
			const data = {
				startTime: stringToDate(start[3])
			};

			this.data[`phase${this.currentPhase}`] = data;
			this.emit('phaseStart', phase, data);
			return;
		}

		const end = endPhase.exec(line);
		if (end) {
			const phase = end[1];
			const data = {
				seconds: Number(end[2]),
				cpuPercent: Number(end[4]),
				endTime: stringToDate(end[6])
			};

			Object.assign(this.data[`phase${end[1]}`], data);
			this.emit('phaseEnd', phase, data);
			return;
		}
	}

	checkPhaseProgress(line, [regexp, percents]) {
		const match = regexp.exec(line);
		if (match) {
			this.emit('progress', percents[match[1] - 1]);
		}
	}
}

module.exports = function (file) {
	return new Parser(file);
};

module.exports.Parser;
