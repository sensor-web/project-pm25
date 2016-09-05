'use strict';

(function () {
    var markers = {};
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
            noWrap: true,
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        });
        var map = new L.Map('map', {
          center: DEFAULT_CENTER,
          scrollWheelZoom: false,
          zoom: 12,
          layers: [tileLayer]
        });
        map.on('moveend', function () {
            loadMarkers();
        });
        loadMarkers();
    }

    function loadMarkers() {
        var bounds = map.getBounds();
        var query = points2Query([bounds.getNorthEast(), bounds.getNorthWest(), bounds.getSouthWest(), bounds.getSouthEast()]);
        $.get(API_URL+'/pm25/stations', query, function (stations) {
            for (var station of stations) {
                if (undefined == markers[station.id]) {
                    var marker = L.marker([station.coords.latitude, station.coords.longitude], {
                        clickable: true,
                        draggable: false,
                        title: station.display_name,
                        alt: station.display_name
                    });
                    marker.station = station;
                    marker.on('click', function(e) {
                        console.log(this.station.slug);
                    });
                    markers[station.id] = marker;
                    marker.addTo(map);
                }
            }
        });
    }

    function enlargeMarker(marker) {
        var icon = marker.options.icon;
        icon.options.iconSize = [30, 50];
        marker.setIcon(icon);
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
