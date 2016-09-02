'use strict';

(function () {
    var $nearbyStations = $('#nearby-stations');
    loadNearbyStations();

    $('#search-input').materialize_autocomplete({
        multiple: {
            enable: false
        },
        dropdown: {
            el: '#search-dropdown'
        },
        getData: function (value, callback) {
            var options = [];
            $.when(
                $.get(API_URL+'/pm25/stations', {q: value}, function (stations) {
                    for (var station of stations) {
                        station.text = station.slug;
                        options.push(station);
                    }
                }),
                $.get(API_URL+'/pm25/regions', {q: value}, function (regions) {
                    for (var region of regions) {
                        region.text = region.slug;
                        options.push(region);
                    }
                }),
                $.get('http://nominatim.openstreetmap.org/search', {format: 'json', 'accept-language':'zh-TW', q: value}, function (places) {
                    for (var place of places) {
                        place.id = place.place_id;
                        place.text = place.display_name;
                        options.push(place);
                    }
                })
                ).then(function () {
                    callback(value, options);
                });
            }, throttling: true
        });

    if (1 == $('#map').size()) {
        var DEFAULT_CENTER = [25.0375167, 121.5637];
        var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        });
        var map = new L.Map('map', {
          center: DEFAULT_CENTER,
          scrollWheelZoom: false,
          zoom: 12,
          layers: [tileLayer]
        });
    }

    function loadNearbyStations() {
        $nearbyStations.html(getProgressListItem());
        getGeolocation().then(function(coords) {
            $.get(API_URL+'/pm25/stations', coords, function(stations) {
                if (0 == stations.length) {
                    $nearbyStations.html(getNoDataListItem());
                    return;
                }
                var items = '';
                for (var station of stations) {
                    var level = getDAQIStatus(Number.parseInt(station.data.pm2_5));
                    items += getStationListItem(station, level);
                }
                $nearbyStations.html(items);
                $nearbyStations.find('li a').click(function () {
                    ga('send', 'event', 'nearby-stations', 'click', $(this).find('.location').text());
                });
            });
        }).catch(function() {
            $nearbyStations.html(getErrorListItem());
        });
    }
})();
