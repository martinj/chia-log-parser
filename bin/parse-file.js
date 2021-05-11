#!/usr/bin/env node
'use strict';

const parser = require('../');

const [,, file] = process.argv;

if (!file) {
	console.log('Usage: chia-log-parser <plot log file>');
	process.exit(0);
}

parser(file)
	.parse()
	.then(console.log)
	.catch(console.error);
