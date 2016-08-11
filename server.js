var express = require('express');
var app = express();
var hbs = require('hbs');
var geolib = require('geolib');
var config = require('./config.json');
var stations = require('./data/stations.json');
var redirect = require('./data/redirect.json');
var homefeed = require('./data/homefeed.json');
var request = require('request');

hbs.registerPartials(__dirname + '/views/partials');

app.set('view engine', 'html');
app.engine('html', hbs.__express);

if (config.debug) {
  app.use('/pm25', express.static('public'));
}

app.get('/pm25/b?', function(req, res) {
  if (req.path[req.path.length - 1] != '/') {
    if (-1 == req.url.indexOf('?')) {
      res.redirect(req.path + '/');
    } else {
      res.redirect(req.path + '/' + req.url.substr(req.url.indexOf('?')));
    }
    return;
  }
  homefeed.id = 'region_taipei';
  homefeed.survey = req.path == '/pm25/';
  homefeed.fb_app_id = config.fb_app_id;
  homefeed.page_title = '臺北市 PM2.5 即時濃度平均';
  homefeed.page_url = config.site_url + req.url;
  res.render('index', homefeed);
});
app.get('/pm25/request', function(req, res) {
  if (req.path[req.path.length - 1] != '/') {
    if (-1 == req.url.indexOf('?')) {
      res.redirect(req.path + '/');
    } else {
      res.redirect(req.path + '/' + req.url.substr(req.url.indexOf('?')));
    }
    return;
  }
  var data = {};
  data.fb_app_id = config.fb_app_id;
  data.page_title = '申請架設測站';
  data.page_url = config.site_url + req.url;
  res.render('request', data);
});

app.get('/pm25/search', function(req, res) {
  //TODO: check query params and accepted format
  if (req.query.ids) {
    res.json(findStationsByIds(req.query.ids));
  } else if (req.query.latitude != undefined && req.query.longitude != undefined) {
    res.json(findNearbyStations(req.query));
  } else if (req.query.region) {
    res.json(homefeed.average); //hardcoded Taipei average
  }
});

app.get('/pm25/station/:slug/', function(req, res) {
  if (req.path[req.path.length - 1] != '/') {
    if (-1 == req.url.indexOf('?')) {
      res.redirect(req.path + '/');
    } else {
      res.redirect(req.path + '/' + req.url.substr(req.url.indexOf('?')));
    }
    return;
  }
  var location = req.params.slug;
  if (redirect[location]) {
    res.redirect('/pm25/station/'+redirect[location]+'/');
    return;
  }
  if (stations[location]) {
    stations[location].fb_app_id = config.fb_app_id;
    stations[location].page_title = stations[location].display_name + ' PM2.5 即時濃度';
    stations[location].page_url = config.site_url + req.url;
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

function findStationsByIds(ids) {
  if (!Array.isArray(ids)) {
    ids = [ids];
  }
  var localStations = [];
  var now = new Date().getTime();
  for (var slug in stations) {
    if (stations[slug].address.country_code == 'tw' && now - new Date(stations[slug].data.Create_at).getTime() < 1000 * 60 * 60 * 3) {
      for (var id of ids) {
        if (stations[slug].id == id) {
          var station = JSON.parse(JSON.stringify(stations[slug]));
          delete station.address;
          localStations.push(station);
        }
      }
    }
  }
  return localStations;
}


function findNearbyStations(coords) {
  var localStations = [];
  var now = new Date().getTime();
  for (var slug in stations) {
    if (stations[slug].address.country_code == 'tw' && now - new Date(stations[slug].data.Create_at).getTime() < 1000 * 60 * 60 * 3) {
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
