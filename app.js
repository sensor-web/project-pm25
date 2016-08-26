var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var api = express();
var hbs = require('hbs');
var geolib = require('geolib');
var config = require('./config.json');
var redirect = require('./data/redirect.json');
var db = require('./lib/db');
var stations = require('./lib/stations');
var regions = require('./lib/regions');
var subscriptions = require('./lib/subscriptions');
var request = require('request');

hbs.registerPartials(__dirname + '/views/partials');

app.set('view engine', 'html');
app.engine('html', hbs.__express);
app.use(bodyParser.urlencoded({ extended: false }))
app.locals.config = config;

api.use(bodyParser.urlencoded({ extended: false }))
api.use(bodyParser.json())

var allowCORS = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Max-Age: 1000');
  next();
}
api.use(allowCORS);


if (config.debug) {
  app.use('/pm25', express.static('public'));
}

app.get('/pm25/b?', function(req, res) {
  if (addTrailingSlash(req, res)) {
    return;
  }
  Promise.all([
    regions.getBySlug("臺灣臺北市"),
    stations.listByRegionTop("state", "臺北市", "pm2_5"),
    stations.listByRegionTop("country", "臺灣", "pm2_5")
  ]).then(function (results) {
    var region = results[0];
    region.survey = req.path == '/pm25/';
    region.page_title = region.display_name + ' PM2.5 即時濃度平均 - Project SensorWeb';
    region.page_url = config.site_url + req.url;
    region.form_title = 'PM2.5 空氣品質通知';
    region.form_type = 'region';
    region.stateTop = results[1];
    region.countryTop = results[2];
    region.region_id = region.id;
    res.render('index', region);
  }).catch(serverError);
});
app.get('/pm25/request', function(req, res) {
  if (addTrailingSlash(req, res)) {
    return;
  }
  var data = {};
  data.page_title = '申請架設 PM2.5 測站 - Project SensorWeb';
  data.page_url = config.site_url + req.url;
  data.form_title = '';
  data.form_type = '';
  data.location = true;
  res.render('request', data);
});

app.get('/pm25/station/:slug/', function(req, res) {
  if (addTrailingSlash(req, res)) {
    return;
  }
  var location = req.params.slug;
  if (redirect[location]) {
    res.redirect('/pm25/station/'+redirect[location]+'/');
    return;
  }
  stations.getBySlug(location).then(function(station) {
    if (station) {
      station.page_title = station.display_name + ' PM2.5 即時濃度 - Project SensorWeb';
      station.page_url = config.site_url + req.url;
      station.form_title = 'PM2.5 空氣品質通知';
      station.form_type = 'station';
      station.station_id = station.id;
      stations.listByNearestCoords(station.coords, station.id)
      .then(function (nearbyStations) {
        station.nearbyStations = nearbyStations;
        res.render('station', station);
      }).catch(serverError);
    } else {
      notFound();
    }
  }).catch(serverError);
});

app.get('/sitemap.xml', function(req, res) {
    res.sendfile('./data/sitemap.xml');
});

/*
 * API
 */

api.get('/pm25/stations', function(req, res) {
  //TODO: check query params and accepted format
  if (req.query.ids) {
    stations.listByIds(req.query.ids)
    .then(function (stations) {
      res.json(stations);
    }).catch(serverError);
  } else if (req.query.latitude != undefined && req.query.longitude != undefined) {
    stations.listByNearestCoords({latitude: req.query.latitude, longitude: req.query.longitude})
    .then(function (stations) {
      res.json(stations);
    }).catch(serverError);
  }
});

api.get('/pm25/regions', function(req, res) {
  //TODO: check query params and accepted format
  if (req.query.id) {
    regions.getById(req.query.id)
    .then(function (region) {
      res.json(region);
    }).catch(serverError);
  }
});

api.post('/pm25/subscriptions', function(req, res) {
  subscriptions.subscribe(req.body).then(function(result) {
    var sub_id = result.generated_keys || result.existing_keys;
    if (sub_id && sub_id.length) {
      sub_id = sub_id[0];
    }
    res.json({result: 'success', subscription_id: sub_id});
  }).catch(serverError);
});

api.delete('/pm25/subscriptions', function(req, res) {
  subscriptions.unsubscribe(req.body).then(function(result) {
    res.json({result: 'success', subscription_ids: result.existing_keys});
  }).catch(serverError);
});

db.connect(config.rethinkdb).then(function (db) {
  stations.setDatabase(db);
  regions.setDatabase(db);
  subscriptions.setDatabase(db);

  app.listen(config.port, function () {
     console.log('Server listening on port ' + config.port);
  });
  api.listen(config.api_port, function () {
     console.log('API listening on port ' + config.api_port);
  });  
});

function notFound() {
    res.status(404);
    res.type('txt').send('Not Found');
}

function serverError() {
    res.status(500);
    res.type('txt').send('Internal Server Error');
}

function addTrailingSlash(req, res) {
  if (req.path[req.path.length - 1] != '/') {
    if (-1 == req.url.indexOf('?')) {
      res.redirect(req.path + '/');
    } else {
      res.redirect(req.path + '/' + req.url.substr(req.url.indexOf('?')));
    }
    return true;
  }
  return false;
}
