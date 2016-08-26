(function () {
	var DEFAULT_CENTER = [25.0375167, 121.5637];
	var tileLayer = new L.TileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',{
	  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
	});

	var map = new L.Map('map', {
	  'center': DEFAULT_CENTER,
	  'zoom': 12,
	  'layers': [tileLayer]
	});

	var marker = L.marker(DEFAULT_CENTER,{
	  draggable: false
	}).addTo(map);

	map.on('moveend', function(e){
	  updateCoords(map.getCenter());
	});
	$('.modal-trigger').click(function() {
		map.invalidateSize();
		$('.location-input-message').hide();
		var $type = $(this).attr('data-form-type');
		if ('new_station' == $type) {
			$('#wait-station-message').show();
		} else {
			$('#setup-station-message').show();
		}
	});
	var $gpsProgress = $('#gps-progress');
	$('#gps-position').click(function () {
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
		$('#sub-lat').val(coords.lat);
		$('#sub-lng').val(coords.lng);
	}
})();