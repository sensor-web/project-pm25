/**
 * What does this script do?
 * Extract data from 3rd parties and unify structure,
 * Mark if coordinates changed.
 */
var request = require('request');
var fs = require('fs');
var geolib = require('geolib');
var config = require('../config');
var thirdParties = config.parties;
var data = require('./3rdPartyData.json');
var stations = require('./stations.json');
var legacyDataUrl = 'https://api.sensorweb.io/projects/sensorweb/pm25/sensors';

loadSensorDataRecursive();

function changeFieldNames(data) {
	if (data.Dust2_5 != undefined) {
		data.pm2_5 = data.Dust2_5;
	}
	if (data.Temperature != undefined) {
		data.temperature = data.Temperature;
	}
	if (data.Humidity != undefined) {
		data.humidity = data.Humidity;
	}
	if (data.Create_at != undefined) {
		data.create_time = data.Create_at;
	}
	delete data.Dust2_5;
	delete data.Temperature;
	delete data.Humidity;
	delete data.Create_at;
	return data;
}

function coordsValid(coords) {
	return coords && undefined != coords.latitude && undefined != coords.longitude;
}

function updateStations() {
	for (var id in data) {
		data[id].data = changeFieldNames(data[id].data);
		for (var slug in stations) {
 			if (stations[slug].id == id) {
				var distance = 0;
				if (coordsValid(stations[slug].coords) && coordsValid(data[id].coords)) {
					distance = geolib.getDistance(stations[slug].coords, data[id].coords);
				}
 				if (distance < 1000) {
					console.log('update data for '+id);
					stations[slug].data = data[id].data;
					delete stations[slug].Create_at;
 				}
			} else {
				stations[slug].data = changeFieldNames(stations[slug].data);
				delete stations[slug].Create_at;
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
		if (stations) {
			updateStations();
			//TODO: identify outdated data & provide redirections
			fs.writeFile('./3rdPartyData.json', JSON.stringify(data, null, 4), function(err) {
			    if(err) {
			        return console.log(err);
			    }
			    console.log('3rdPartyData.json was saved!');
			});
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
	if ('legacy' == party) {
	    request(legacyDataUrl, 
		function(error, response, body) {
	        if (!error && response.statusCode == 200) {
	        	var partyData = JSON.parse(body);
			    for (var entry of partyData) {
			    	var did = 'legacy_'+entry._id;
			    	if (entry.pm25Index < 1000) {
				    	data[did] = loadLegacyData(entry, data[did]);
			    	}
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
	} else {
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
}

function loadLegacyData (legacyData, existingEntry) {
	 var data = {};
	 data.id = 'legacy_'+legacyData._id;
	 data.display_name = '';
	 data.party = 'legacy';
	 data.create_time = new Date(legacyData.createDate);
	 data.data = {
	 	pm2_5: legacyData.pm25Index,
	 	create_time: new Date(legacyData.latestUpdate)
	 };
	 data.coords = {
	 	latitude: Number.parseFloat(legacyData.coords.lat),
	 	longitude: Number.parseFloat(legacyData.coords.lng)
	 }
	 if (existingEntry && existingEntry.address) {
	 	data.address = existingEntry.address;
	 }
	 return data;
}

function loadSensorData(id, party, entry, existingEntry) {
	var newEntry = existingEntry ? existingEntry : {};
	newEntry.id = id;
	newEntry.party = party;
	newEntry.data = changeFieldNames(entry.Data);

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



