var express = require('express');
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

app.get('/pm25/station/*/', function(req, res) {
  var segments = req.path.split('/');
  var location = decodeURIComponent(segments[3]);
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
