var express = require('express');
var geolib = require('geolib');
var config = require('./config.json');
var stations = require('./data/stations.json');
var redirect = require('./data/redirect.json');
var homefeed = require('./data/homefeed.json');
var app = express();
var request = require('request');

app.set('view engine', 'html');
app.engine('html', require('hbs').__express);

if (config.debug) {
  app.use('/pm25', express.static('public'));
}

app.get('/pm25/', function(req, res) {
  res.render('index', homefeed);
});

app.get('/pm25/search', function(req, res) {
  //TODO: check query params and accepted format
  res.json(findNearbyStations(req.query));
});

app.get('/pm25/station/:slug/', function(req, res) {
  var location = req.params.slug;
  if (redirect[location]) {
    res.redirect('/pm25/station/'+redirect[location]+'/');
    return;
  }
  if (stations[location]) {
    res.render('station', stations[location]);
  } else {
    res.status(404);
    res.type('txt').send('Not found');
  }
});

app.get('/sitemap.xml', function(req, res) {
    res.sendfile('./data/sitemap.xml');
});

app.listen(config.port, function () {
	 console.log('Server listening on port ' + config.port);
});

function findNearbyStations(coords) {
  var localStations = [];
  var homefeed = {average:{Create_at: new Date().toISOString()}};
  var now = new Date().getTime();
  for (var slug in stations) {
    if (stations[slug].address.state == '臺北市' && now - new Date(stations[slug].data.Create_at).getTime() < 1000 * 60 * 60 * 3) {
      var station = JSON.parse(JSON.stringify(stations[slug]));
      delete station.address;
      station.distance = geolib.getDistance(coords, station.coords);
      localStations.push(station);
    }
  }
  localStations = localStations.filter(function(s) {
    return s.distance < 3000;
  });
  localStations.sort(function(a, b) {
    return a.distance - b.distance;
  });
  return localStations.slice(0, 10);
}

