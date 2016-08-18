var stations = require('./stations.json');
var fs = require('fs');
var countryStations = [];
var homefeed = {average:{create_time: new Date().toISOString().replace(/\.[0-9]+Z/, 'Z')}};
var now = new Date().getTime();
for (var slug in stations) {
	if (stations[slug].address.country_code == 'tw' && now - new Date(stations[slug].data.create_time).getTime() < 1000 * 60 * 60 * 3 && stations[slug].data.pm2_5 < 1000) {
		countryStations.push(stations[slug]);
	}
}
countryStations.sort(function(a, b) {
	return b.data.pm2_5 - a.data.pm2_5;
});

var stateStations = countryStations.filter(function(s) {
	return s.address.state == '臺北市';
});
var sum = 0;
for (var stateStation of stateStations) {
	sum += stateStation.data.pm2_5;
}
homefeed.average.pm2_5 = Math.round(sum/stateStations.length);

homefeed.countryTop = countryStations.slice(0, 10);
homefeed.stateTop = stateStations.slice(0, 10);

removeAddress(homefeed.stateTop);
removeAddress(homefeed.countryTop);

fs.writeFile('./homefeed.json', JSON.stringify(homefeed, null, 4), function(err) {
    if(err) {
        return console.log(err);
    }
    console.log('homefeed.json was saved!');
});

function removeAddress(stations) {
	for (var station of stations) {
		delete station.address;
	}
}
