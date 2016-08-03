var $nearbyStations = $('#nearby-stations');
loadNearbyStations();
function loadNearbyStations() {
  $nearbyStations.html('<li class="nodata"><div class="progress"><div class="indeterminate"></div></div></li>');
  getGeolocation().then(function(coords) {
    console.log(coords);
    $.get('/pm25/search', coords, function(stations) {
      // console.log(stations);
      var items = '';
      for (var station of stations) {
        var level = getDAQIStatus(Number.parseInt(station.data.Dust2_5));
        items += `
                  <li>
                      <a href="/pm25/station/${station.slug}/">
                         <span class="concentration"><span class="concentration-value ${level}">${ station.data.Dust2_5 }</span><span id="unit">&micro;g/m&sup3;</span></span>
                         <span class="location">@${ station.display_name } <span class="distance">(距離 ${station.distance/1000} 公里)</span></span>
                         <time class="update-time" data-livestamp="${ station.data.Create_at }"></time>
                      </a>
                   </li>`;

      }
      $nearbyStations.html(items);
    });
  }).catch(function() {
      $nearbyStations.html('<li class="nodata">無法取得 GPS 定位資訊，請檢查 GPS 定位功能是否開啟，並<a href="javascript:loadNearbyStations();">點此再試一次</a>。</li>');
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
