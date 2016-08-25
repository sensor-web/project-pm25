'use strict';

var r = require('rethinkdb');

function Database() {}

Database.prototype = {};

Database.prototype.connect = function (config) {
	var db = this;
	this.config = config;
	return new Promise(function(resolve, reject) {
		console.log('connecting database '+config.db);
		r.connect(config).then(function (connection) {
			console.log('connected to database ' + config.db);
			db.connection = connection;
			resolve(db);
		}).catch(reject);
	});
};
Database.prototype.disconnect = function () {
	return this.connection.close();
};

Database.prototype.dropDatabase = function (dbName) {
	var db = this;
	return new Promise(function(resolve, reject) {
		console.log('dropping database ' + dbName);
	    r.dbDrop(dbName).run(db.connection).then(resolve).catch(reject);
	});
};

Database.prototype.createDatabaseIfNotExist = function (dbName) {
	var db = this;
	return new Promise(function(resolve, reject) {
		console.log('creating database ' + dbName);
	    r.dbList().contains(dbName).do(function(containsDb) {
	      return r.branch(
	        containsDb,
	        {created: 0},
	        r.dbCreate(dbName)
	      );
		}).run(db.connection).then(resolve).catch(reject);
	});
};

Database.prototype.createTableIfNotExist = function (tableName) {
	var db = this;
	return function () {
		return new Promise(function(resolve, reject) {
			console.log('creating table ' + tableName);
			r.tableList().contains(tableName).do(function(containsTable) {
		      return r.branch(
		        containsTable,
		        {created: 0},
		        r.tableCreate(tableName)
		      );
		    }).run(db.connection).then(resolve).catch(reject);
		});
	};
};

Database.prototype.createIndexIfNotExist = function (tableName, indexName, indexOptions) {
	var db = this;
	return new Promise(function(resolve, reject) {
		console.log('creating index ' + indexName + ' on ' + tableName);
		r.table(tableName).indexList().contains(indexName).do(function(hasIndex) {
	      return r.branch(
	        hasIndex,
	        {created: 0},
	        indexOptions == undefined ? r.table(tableName).indexCreate(indexName) : r.table(tableName).indexCreate(indexName, indexOptions)
	      );
	    }).run(db.connection).then(resolve).catch(reject);
	});
};

module.exports = new Database();