var $nearbyStations = $('#nearby-stations');
loadNearbyStations();

function loadNearbyStations() {
  $nearbyStations.empty();
  getGeolocation().then(function(coords) {
    console.log(coords);
    $.get('/pm25/search', coords, function(stations) {
      // console.log(stations);
      var items = '';
      for (var station of stations) {
        items += `
                  <li>
                      <a href="/pm25/station/${station.slug}/">
                         <span>${ station.data.Dust2_5 }</span><span id="unit">&micro;g/m&sup3;</span>
                         <span>${ station.display_name }</span>
                         <time class="update-time" data-livestamp="${ station.data.Create_at }"></time>
                      </a>
                   </li>`;

      }
      $nearbyStations.html(items);
    });
  }).catch(function() {
      $nearbyStations.html('<li>無法取得 GPS 定位資訊，請<a href="javascript:loadNearbyStations();">點此再試一次</a>。</li>');
  });
}

function getGeolocation() {
  return new Promise(function(resolve, reject) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        resolve(position.coords);
      }, function() {
        reject('Browser unable to get current location');
      });
    } else {
      reject('Browser doesn\'t support Geolocation');
    }
  });
}
