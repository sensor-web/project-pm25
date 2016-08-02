var sm = require('sitemap');
var fs = require('fs');
var stations = require('./stations.json');
var urls = [{
	url: 'https://sensorweb.io/pm25/',
	changefreq: 'hourly',
	priority: 0.8
}];
for (var slug in stations) {
	var url = {
		url: 'https://sensorweb.io/pm25/station/'+slug+'/',
		changefreq: 'hourly',
		priority: 0.8
	};
	urls.push(url);
}

var sitemap = sm.createSitemap({
    hostname: 'http://sensorweb.com',
    cacheTime: 3600000,  //600 sec (10 min) cache purge period 
    urls: urls
});
 
fs.writeFileSync("./sitemap.xml", sitemap.toString());