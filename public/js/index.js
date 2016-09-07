'use strict';

(function () {
    var markers = {};
    var ac_coords = {};
    var currentId;
    var currentMarker;
    var $nearbyStations = $('#nearby-stations');
    loadNearbyStations();

    var $search = $('#search-input');
    var $ac = $search.materialize_autocomplete({
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
                        ac_coords[station.id] = station.coords;
                        options.push(station);
                    }
                }),
                $.get(API_URL+'/pm25/regions', {q: value}, function (regions) {
                    for (var region of regions) {
                        region.text = region.slug;
                        ac_coords[region.id] = region.coords;
                        options.push(region);
                    }
                }),
                $.get('https://nominatim.openstreetmap.org/search', {format: 'json', 'accept-language':'zh-TW', q: value}, function (places) {
                    for (var place of places) {
                        place.id = place.place_id;
                        place.text = place.display_name;
                        ac_coords[place.id] = {latitude: place.lat, longitude: place.lng};
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
    $ac.$dropdown.click(function (e) {
        currentId = $ac.$hidden.val();
        var coords = ac_coords[currentId];
        map.setView({lat: coords.latitude, lng:coords.longitude});
    });

    function selectMarker(marker) {
        if (currentMarker) {
            currentMarker.setOpacity(0.6);
        }
        currentMarker = marker;
        currentMarker.setOpacity(1.0);
    }

    function loadMarkers() {
        var bounds = map.getBounds();
        var query = points2Query([bounds.getNorthEast(), bounds.getNorthWest(), bounds.getSouthWest(), bounds.getSouthEast()]);
        $.get(API_URL+'/pm25/stations', query, function (places) {
            updateMarkers('station', places);
        });
        $.get(API_URL+'/pm25/regions', query, function (places) {
            updateMarkers('region', places);
        });
    }

    function updateMarkers(type, places) {
        for (var place of places) {
            place.type = type;
            if (undefined == markers[place.id]) {
                var marker = L.marker([place.coords.latitude, place.coords.longitude], {
                    clickable: true,
                    draggable: false,
                    opacity: 0.5,
                    riseOnHover: true,
                    title: place.display_name,
                    alt: place.display_name
                });
                if (type == 'region') {
                    enlargeMarker(marker);
                } else {
                    normalMarker(marker);
                }
                marker.place = place;
                marker.on('click', function(e) {
                    selectMarker(this);
                });
                markers[place.id] = marker;
                marker.addTo(map);
            }
        }
        if (undefined != markers[currentId]) {
            selectMarker(markers[currentId]);
        }
    }

    function normalMarker(marker) {
        var icon = marker.options.icon;
        icon.options.iconSize = [25, 41];
        marker.setIcon(icon);
    }
    function enlargeMarker(marker) {
        var icon = marker.options.icon;
        icon.options.iconSize = [45, 75];
        marker.setIcon(icon);
        marker.setZIndexOffset(1000);
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
