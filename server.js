var express = require('express');
var config = require('./config.json');
var slug = require('./slug.json');
var app = express();
var request = require('request');

app.set('view engine', 'html');
app.engine('html', require('hbs').__express);

if (config.debug) {
  app.use('/pm25', express.static('public'));
}

app.get('/pm25/station/*/', function(req, res) {
  // res.sendFile(__dirname + '/station.html');
  var segments = req.path.split('/');
  var location = decodeURIComponent(segments[3]);
  var device_id = slug[location];
  var data = {
  	title: location + ' PM2.5 即時濃度',
  	location: location,
  	device_id: device_id
  }

  res.render('station', data);
});

app.listen(config.port, function () {
	 console.log('Server listening on port ' + config.port);
});
