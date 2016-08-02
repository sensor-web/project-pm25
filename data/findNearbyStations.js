var geolib = require('geolib');
var stations = require('./stations.json');
var currentCoords = {latitude: 25.027, longitude: 121.545};

function findNearbyStations(coords) {
	var localStations = [];
	var homefeed = {average:{Create_at: new Date().toISOString()}};
	var now = new Date().getTime();
	for (var slug in stations) {
		if (stations[slug].address.state == '臺北市' && now - new Date(stations[slug].data.Create_at).getTime() < 1000 * 60 * 60 * 3) {
			var station = JSON.parse(JSON.stringify(stations[slug]));
			delete station.address;
			station.distance = geolib.getDistance(currentCoords, station.coords);
			localStations.push(station);
		}
	}
	localStations = localStations.filter(function(s) {
		return s.distance < 3000;
	});
	localStations.sort(function(a, b) {
		return a.distance - b.distance;
	});
	return localStations;
}
console.log(findNearbyStations(currentCoords).slice(0, 10));
