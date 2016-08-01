/**
 * What does this script do?
 * Extract data from 3rd parties and unify structure,
 * Mark if coordinates changed.
 */
var request = require('request');
var fs = require('fs');
var thirdParties = require('./3rdParties.json');
var data = require('./3rdPartyData.json');
var stations = require('./stations.json');

loadSensorDataRecursive();

function updateStations() {
	for (var id in data) {
		for (var slug in stations) {
			if (stations[slug].id == id) {
				console.log('update data for '+id);
				stations[slug].data = data[id].data;
			}
		}
	}
}

function loadSensorDataRecursive() {
	var thirdParty = thirdParties.pop();
	if (thirdParty) {
		load3rdPartyData(thirdParty, loadSensorDataRecursive);
	} else {
		console.log(Object.keys(data).length+' stations loaded.');
		//TODO: identify outdated data & provide redirections
		fs.writeFile('./3rdPartyData.json', JSON.stringify(data, null, 4), function(err) {
		    if(err) {
		        return console.log(err);
		    }
		    console.log('3rdPartyData.json was saved!');
		});
		if (stations) {
			updateStations();
			fs.writeFile('./stations.json', JSON.stringify(stations, null, 4), function(err) {
			    if(err) {
			        return console.log(err);
			    }
			    console.log('stations.json was saved!');
			});
		}
	}
}

function load3rdPartyData(party, callback) {
	console.log();
    request('http://g0vairmap.3203.info/Data/'+party+'_last.json', 
	function(error, response, body) {
        if (!error && response.statusCode == 200) {
        	var partyData = JSON.parse(body);
		    for (var entry of partyData) {
		    	var did;
		    	if (entry.RawData.device_id) {
		    		did = party+'_'+entry.RawData.device_id;
		    	} else if (entry.Channel_id){
		    		did = party+'_'+entry.Channel_id
		    	}
				if (!data[did]) {
					console.log('new device id'+did);
				}
		        data[did] = loadSensorData(did, party, entry, data[did]);
		    }
            fs.writeFile('./'+party+'_last.json', JSON.stringify(partyData, null, 4), function(err) {
                if(err) {
                    return console.log(err);
                }
            	console.log(party+'_last.json was saved!');
            	if (callback) {
            		callback();
            	}
        	}); 
    	}
    });
}

function loadSensorData(id, party, entry, existingEntry) {
	var newEntry = existingEntry ? existingEntry : {};
	newEntry.id = id;
	newEntry.party = party;
	newEntry.data = entry.Data;

	var coordsChanged = false;
	if (newEntry.coords && (entry.LatLng.lat != newEntry.coords.latitude || entry.LatLng.lng != newEntry.coords.longitude)) {
		coordsChanged = true;
	}
	newEntry.coords = {
		latitude: entry.LatLng.lat, 
		longitude: entry.LatLng.lng
	};
	if (coordsChanged) {
		newEntry.coords.changed = true;
	}

	var display_name = '';
	if ('EPA' == party) {
		display_name = entry.SiteName;
	} else if ('Webduino' == party) {
		display_name = entry.SiteName.replace(/u'(.+)'/g, '$1').replace(/\s+#[0-9+]/g, '');
	} else if (party == 'Airbox' && !entry.SiteName.match('[A-z0-9_-]')) {
		display_name = entry.SiteName;
	}
	newEntry.display_name = display_name;

	return newEntry;
}



