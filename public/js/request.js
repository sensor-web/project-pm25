'use strict';

(function () {
	$('.subscribe-modal').each(function () {
		var firstMapMove = true;
		var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
		});
		var mapElem = $(this).find('.map').get(0);
		var $lat = $(this).find('.sub-lat');
		var $lng = $(this).find('.sub-lng');
		var map = new L.Map(mapElem, {
			center: DEFAULT_CENTER,
			scrollWheelZoom: false,
			zoom: DEFAULT_ZOOM,
			layers: [tileLayer]
		});
        map.zoomControl.setPosition('bottomleft');

		var marker = L.marker(DEFAULT_CENTER,{
			draggable: false
		}).addTo(map);
		map.on('move', function(e){
			if (firstMapMove) {
				//First map initialization, do nothing here.
				firstMapMove = false;
			} else {
				updateCoords(map.getCenter());
			}
		});
		$('.modal-trigger').click(function() {
			map.invalidateSize();
		});
		var $gpsProgress = $(this).find('.gps-progress');
		$(this).find('.gps-position').click(function () {
			$gpsProgress.show();
			getGeolocation().then(function(coords) {
				$gpsProgress.hide();
				var center = {lat: coords.latitude, lng: coords.longitude};
				updateCoords(center);
				map.setView(center);
			});
		});

		function updateCoords(coords) {
			marker.setLatLng(coords);
			$lat.val(coords.lat);
			$lng.val(coords.lng);
	        ga('send', 'event', 'sensor-form', 'location-change', 'pm25');
		}
	});
})();