var request = require('request');
var util = require('util');
var fs = require('fs');
var data = require('./3rdPartyData.json');
var stationQueue = [];
var stations = require('./stations.json');
var FIELDS_1ST_SEG = ["state", "county", "city"];
var FIELDS_2ND_SEG = ["state_district", "town", "suburb", "city_district", "village", "hamlet", "city", "county"];
var FIELDS_3RD_SEG = [
	"school",
    "building",
    "bus_stop",
    "library",
    "townhall",
    "swimming_pool",
    "university",
    "hospital",
    "park",
    "address29",
    "ruins",
    "public_building",
    "footway",
    "information"];
var FIELDS_3RD_SEG_ALT = [
	"post_office",
    "supermarket",
    "parking",
    "restaurant",
    "hostel",
    "community_centre",
    "place_of_worship",
    "pitch",
    "convenience",
    "fuel",
    "hotel",
    "cafe",
    "car_wash",
    "fast_food",
    "house_number"];
var FIELDS_3RD_SEG_RD_ALT = ["hamlet", "village", "city_district"];
var TOPDOWN_ADDR_COUNTRIES = ["tw", "jp", "kr", "cn"];

//TODO: check redirect.json for old stations get back to life

for (var id in data) {
	stationQueue.push(data[id]);
}

var GEOCODE_API = "http://nominatim.openstreetmap.org/reverse?format=json&lat=%d&lon=%d&addressdetails=1";

function reverseGeocode(id, lat, lng, resolve, reject) {
	var options = {
	    url: util.format(GEOCODE_API, lat, lng),
	    headers: {
	        'user-agent': 'Mozilla/5.0 (X11; Linux i586; rv:31.0) Gecko/20100101 Firefox/31.0'
	    }
	};

	request(options, 
	    function(error, response, body) {
	        if (!error && response.statusCode == 200) {
				console.log('Loaded data for: ' + id);
	        	if (resolve) {
	        		resolve(JSON.parse(body));
	        	}
	        } else {
				console.log('Error loading data for device: ' + id);
	        	if (reject) {
	        		reject();
	        	}
	        }
	    }); 
}

function loadGeocodeRecursive() {
	var station = stationQueue.pop();
	if (station) {
		if ((!station.address || station.coords.changed) && station.coords.latitude != undefined && station.coords.latitude != undefined) {
			console.log((station.coords.changed ? 'Updating address' : 'Loading new address') + ' for ' + station.id);
			reverseGeocode(station.id, station.coords.latitude, station.coords.longitude, function(result) {
				data[station.id].address = result.address;
				delete data[station.id].coords.changed;
				setTimeout(loadGeocodeRecursive, 1500);
			});
		} else {
			loadGeocodeRecursive();
		}
	} else {
		fs.writeFile('./3rdPartyData.json', JSON.stringify(data, null, 4), function(err) {
		    if(err) {
		        return console.log(err);
		    }
		    console.log('3rdPartyData.json was saved!');
			// data = require('./3rdPartyData.json');
			updateStations();
		});
	}
}

function updateStations() {
	for (var id in data) {
		var addr = data[id].address;
		if (addr) {
			var seg1 = get1stSegment(addr);
			var seg2 = get2ndSegment(addr);
			var seg3 = get3rdSegment(addr);
			if (seg1 && seg2 && seg3) {
				if ('' == data[id].display_name) {
					data[id].display_name = seg3;
				}
				var slug;
				if (-1 == TOPDOWN_ADDR_COUNTRIES.indexOf(data[id].address.country_code)) {
					slug = data[id].display_name + ', ' + seg2 + ', '+ seg1;
				} else {
					slug = seg1 + seg2 + data[id].display_name;
				}
				data[id].slug = slug;
				stations[slug] = data[id];
			} else {
				console.log(id+' invalid: '+slug);
			}
		}
	}

	fs.writeFile('./stations.json', JSON.stringify(stations, null, 4), function(err) {
	    if(err) {
	        return console.log(err);
	    }
	    console.log('stations.json was saved!');
	});
}

	
function get1stSegment(address) {
	for (var field of FIELDS_1ST_SEG) {
		if (address[field]) {
			return address[field];
		}
	}
	return null;
}

function get2ndSegment(address) {
	for (var field of FIELDS_2ND_SEG) {
		if (address[field]) {
			return address[field].replace(/\s*\([A-z0-9\s]+\)\s*/g, '');
		}
	}
	return null;	
}

function get3rdSegment(address) {
	for (var field of FIELDS_3RD_SEG) {
		if (address[field]) {
			return address[field];
		}
	}
	if (address['road']) {
		for (var field of FIELDS_3RD_SEG_ALT) {
			if (address[field]) {
				return address['road'] + ' ' + address[field];
			}
		}
		return address['road'];
	} else {
		for (var field of FIELDS_3RD_SEG_RD_ALT) {
			if (address[field]) {
				return address[field];
			}
		}
	}
	return null;
}

loadGeocodeRecursive();
