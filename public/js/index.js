var $nearbyStations = $('#nearby-stations');
loadNearbyStations();
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
