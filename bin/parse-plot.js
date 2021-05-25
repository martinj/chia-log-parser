#!/usr/bin/env node
'use strict';

const {plotParser} = require('../');

const [,, file] = process.argv;

if (!file) {
	console.log('Usage: chia-plot-parser <plot log file>');
	process.exit(0);
}

plotParser(file)
	.parse()
	.then((data) => console.log(JSON.stringify(data, null, 2)))
	.catch(console.error);
