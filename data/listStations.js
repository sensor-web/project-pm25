var stations = require('./stations.json');
for (var slug in stations) {
	console.log(slug);
}
console.log(Object.keys(stations).length);