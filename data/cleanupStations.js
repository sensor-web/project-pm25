var fs = require('fs');
var stations = require('./stations.json');

for (var slug in stations) {
	if (stations[slug].address.country_code != 'tw') {
		delete stations[slug];
	}
}

fs.writeFile('./stations.json', JSON.stringify(stations, null, 4), function(err) {
    if(err) {
        return console.log(err);
    }
    console.log('stations.json was saved!');
});
