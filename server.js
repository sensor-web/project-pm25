var express = require('express');
var slug = require('./slug.json');
var app = express();
var request = require('request');

app.set('view engine', 'html');
app.engine('html', require('hbs').__express);

app.use(express.static('public'));

app.get('/station/*/', function(req, res) {
  // res.sendFile(__dirname + '/station.html');
  var segments = req.path.split('/');
  var location = decodeURIComponent(segments[2]);
  var device_id = slug[location];
  var data = {
  	title: location + ' PM2.5 即時濃度',
  	location: location,
  	device_id: device_id
  }

  res.render('station', data);
});

app.listen(3000, function () {
	 console.log('Server listening on port 3000');
});
