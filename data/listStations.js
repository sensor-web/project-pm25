var stations = require('./stations.json');
for (var slug in stations) {
	console.log('https://sensorweb.io/pm25/station/'+slug+'/');
}
console.log(Object.keys(stations).length);
