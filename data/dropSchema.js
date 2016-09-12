'use strict';

var config = require('../config');
var db = require('../lib/db');

db.connect(config.rethinkdb).then(function () {
	db.dropDatabase(config.rethinkdb.db)
	.then(function(result) {
		db.disconnect();
		console.log('Schema dropped!');
	})
	.catch(function(error) {
	  console.log(error);
	});
});

