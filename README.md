
# Chia log parser

Parses chia plot and harvest logs

## Install

	npm i chia-log-parser

## Examples

### Plot Parser

```javascript
const {plotParser} = require('chia-log-parser');

const parser = plotParser('/Users/home/.chia/mainnet/plotter/plot_log_xxx');
['phaseStart', 'phaseEnd', 'error', 'started', 'finished', 'done', 'progress'].forEach((event) => {
	parser.on(event, (...args) => console.log(`[${event}]`, ...args));
});

// if you only want to go by event
parser.start();

// get the full data
const plotData = await parser.parse();

// monitor log file in progress
parser.watch();
```

**Parsed output**

```javascript
	{
	  tmpDirs: [ '/tmp', '/tmp' ],
	  id: 'xxxxx',
	  plotSize: 32,
	  bufferSize: 3390,
	  buckets: 128,
	  threads: 2,
	  stripeSize: 65536,
	  phase1: {
	    startTime: 2021-05-08T09:38:18.000Z,
	    seconds: 9998.132,
	    cpuPercent: 145.15,
	    endTime: 2021-05-08T12:24:56.000Z
	  },
	  phase2: {
	    startTime: 2021-05-08T12:24:56.000Z,
	    seconds: 4188.688,
	    cpuPercent: 98.23,
	    endTime: 2021-05-08T13:34:45.000Z
	  },
	  phase3: {
	    startTime: 2021-05-08T13:34:45.000Z,
	    seconds: 7607.997,
	    cpuPercent: 98.21,
	    endTime: 2021-05-08T15:41:33.000Z
	  },
	  phase4: {
	    startTime: 2021-05-08T15:41:33.000Z,
	    seconds: 552.296,
	    cpuPercent: 99.46,
	    endTime: 2021-05-08T15:50:45.000Z
	  },
	  finalFileSize: 101.42,
	  totalTimeSeconds: 22347.115,
	  cpu: 119.24,
	  finishedTime: 2021-05-08T15:50:45.000Z,
	  copyTimeSeconds: 152.474,
	  copyCpu: 75.12,
	  copyFinishedTime: 2021-05-08T15:53:19.000Z
	}
```

### Harvest Parser

```javascript
const {harvestParser} = require('chia-log-parser');
const parser = harvestParser('/Users/foobar/.chia/mainnet/log/debug.log');

['load', 'warning', 'signagePoint'].forEach((event) => {
	parser.on(event, (...args) => console.log(`[${event}]`, ...args));
});

parser.watch().catch(console.log);
// [signagePoint] {
//   timestamp: 2021-05-25T16:36:16.305Z,
//   eligible: 0,
//   hash: '3ed0740787',
//   proofs: 0,
//   duration: 0.00487,
//   plots: 73
// }
// [warning] {
//   timestamp: 2021-05-21T09:11:48.229,
//   message: 'Directory: /Volumes/foobar/plots does not exist.'
// }
// [load] {
//   plots: 66,
//   size: 6.532919835822213,
//   sizeUnit: 'TiB',
//   time: 0.08295607566833496,
//   timestamp: new Date('2021-05-22T15:37:57.822')
// }

// parse from start to end
parser.parse().then((data) => {
	// data =
	// {
	//   load: [...],
	//   signagePoint: [...],
	//   warning: [...]
	// }
});
```
