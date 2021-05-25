'use strict';
const fs = require('fs');
const {stat: fsStat} = fs.promises;
const {parse: parseDate} = require('date-fns');
const FileParser = require('./fileparser');

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
	return parseDate(str.replace(/\s{2}/g, ' '), 'EEE MMM d HH:mm:ss yyyy', new Date());
}

class PlotParser extends FileParser {
	constructor(file) {
		super(file);
		this.on('line', (line) => this.onNewLine(line));
	}

	async onStart() {
		const fileStat = await fsStat(this.file);
		this.data.created = fileStat.birthtime;
		this.data.modified = fileStat.mtime;
	}

	reset() {
		super.reset();
		this.startIndex = 0;
		this.endIndex = 0;
		this.currentPhase = 0;
		this.started = false;
		this.finished = false;
	}

	onNewLine(line) {
		if (!line.length || this.finished) {
			return;
		}

		if (!this.started) {
			const stage = startPlot[this.startIndex];
			const match = stage.regexp.exec(line);
			if (match) {
				this.startIndex++;
				this.onFilter(stage, [...match], this.data);
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
				this.onFilter(stage, [...match], this.data);
				this.finished = stage.event === 'finished';
			}
		}
	}

	isFinished() {
		return this.finished;
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
	return new PlotParser(file);
};

module.exports.PlotParser;
if (process.env.NODE_ENV === 'test') {
	module.exports.stringToDate = stringToDate;
}
// const parser = new PlotParser('/Users/martin/.chia/mainnet/plotter/pny_2021-05-21_13_38_03_581568.log');
// ['phaseStart', 'phaseEnd', 'error', 'started', 'finished', 'done', 'progress'].forEach((event) => {
// 	parser.on(event, (...args) => console.log(`[${event}]`, ...args));
// });

// parser.watch().catch(console.log);
