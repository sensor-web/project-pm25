var stations = require('./stations.json');
var fs = require('fs');
var localStations = [];
var homefeed = {average:{Create_at: new Date().toISOString()}};
var now = new Date().getTime();
for (var slug in stations) {
	if (stations[slug].address.state == '臺北市' && now - new Date(stations[slug].data.Create_at).getTime() < 1000 * 60 * 60 * 3) {
		delete stations[slug].address;
		localStations.push(stations[slug]);
	}
}
localStations.sort(function(a, b) {
	return b.data.Dust2_5 - a.data.Dust2_5;
});

var sum = 0;
for (var localStation of localStations) {
	sum += localStation.data.Dust2_5;
}
homefeed.average.Dust2_5 = Math.round(sum/localStations.length);
homefeed.byConcentration = localStations.slice(0, 10);

fs.writeFile('./homefeed.json', JSON.stringify(homefeed, null, 4), function(err) {
    if(err) {
        return console.log(err);
    }
    console.log('homefeed.json was saved!');
});
