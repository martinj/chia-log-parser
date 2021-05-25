'use strict';

module.exports = {
	mapFilterValues
};

function mapFilterValues(values, match, data) {
	values.forEach((v, idx) => {
		if (v === undefined) {
			return;
		}

		if (Array.isArray(v)) {
			const [key, fn] = v;


			if (fn) {
				data[key] = fn(match[idx + 1]);
				return;
			}

			if (!data[key]) {
				data[key] = [];
			}

			data[key].push(match[idx + 1]);
			return;
		}

		if (typeof (v) === 'function') {
			Object.assign(data, v(match[idx + 1]));
			return;
		}

		data[v] = match[idx + 1];
	});

	return data;
}
