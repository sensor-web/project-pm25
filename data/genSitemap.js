var sm = require('sitemap');
var fs = require('fs');
var config = require('../config');
var db = require('../lib/db');
var stations = require('../lib/stations');
var regions = require('../lib/regions');
var ctx = {
    locale: 'en'
};
var urls = [{
	url: 'https://sensorweb.io/pm25/',
	changefreq: 'hourly',
	priority: 0.8
}];

db.connect(config.rethinkdb).then(function (db) {
    stations.setDatabase(db);
    stations.setAqi(config.aqi);
    regions.setDatabase(db);
    regions.setAqi(config.aqi);

    stations.list(ctx).then(function (stations) {
        for (var station of stations) {
            var url = {
                url: 'https://sensorweb.io/pm25/station/'+station.slug+'/',
                changefreq: 'hourly',
                priority: 0.8
            };
            urls.push(url);
        }
        return regions.list(ctx);
    }).then(function (regions) {
        for (var region of regions) {
            var url = {
                url: 'https://sensorweb.io/pm25/region/'+region.slug+'/',
                changefreq: 'hourly',
                priority: 0.9
            };
            urls.push(url);
        }
        return db.disconnect();
    }).then(function () {
        var sitemap = sm.createSitemap({
            hostname: 'http://sensorweb.com',
            cacheTime: 3600000,  //600 sec (10 min) cache purge period 
            urls: urls
        });
        fs.writeFileSync("./sitemap.xml", sitemap.toString());
        console.log(urls.length+' URLs written to sitemap.xml');
    }).catch(function (error) {
        console.log(error);
    });
});

