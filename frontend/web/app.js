(function() {
  var AccidentFinder, AccidentsMarkerRenderer, AccidentsTableRenderer, AddressSearchForm, CITIES, COLORS, ChartSeriesMaker, DEFAULT_MAX_YEAR, DEFAULT_MIN_YEAR, Manager, Renderer, RouteFinder, RouteRenderer, State, SummaryRenderer, TrendChartRenderer, URL, WORST_ACCIDENT_RADIUS, WorstLocationsRenderer, make_expander, selectText,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  URL = 'http://localhost:8000/%{city}';

  DEFAULT_MIN_YEAR = 2007;

  DEFAULT_MAX_YEAR = 2011;

  COLORS = {
    driving: '#cccc00',
    bicycling: '#00cc00',
    both: '#77cc00'
  };

  CITIES = {
    vancouver: {
      latitude: 49.2505,
      longitude: -123.1119,
      zoom: 12,
      minYear: 2006,
      maxYear: 2010,
      bounds: new google.maps.LatLngBounds(new google.maps.LatLng(49.131859, -123.264954), new google.maps.LatLng(49.352188, -122.985718))
    },
    calgary: {
      latitude: 51.0451,
      longitude: -114.0569,
      zoom: 12,
      minYear: 1996,
      maxYear: 2011,
      bounds: new google.maps.LatLngBounds(new google.maps.LatLng(50.842941, -114.613968), new google.maps.LatLng(51.343868, -113.901817))
    },
    toronto: {
      latitude: 43.6517,
      longitude: -79.3827,
      zoom: 13,
      minYear: 1986,
      maxYear: 2010,
      bounds: new google.maps.LatLngBounds(new google.maps.LatLng(43.584740, -79.639297), new google.maps.LatLng(43.855419, -79.115623))
    },
    ottawa: {
      latitude: 45.4214,
      longitude: -75.6919,
      zoom: 12,
      minYear: 2001,
      maxYear: 2010,
      bounds: new google.maps.LatLngBounds(new google.maps.LatLng(44.962002, -76.355766), new google.maps.LatLng(45.536541, -75.246033))
    },
    montreal: {
      latitude: 45.5081,
      longitude: -73.5550,
      zoom: 13,
      minYear: 2006,
      maxYear: 2010,
      bounds: new google.maps.LatLngBounds(new google.maps.LatLng(45.413479, -73.976608), new google.maps.LatLng(45.704788, -73.476418))
    },
    halifax: {
      latitude: 44.6479,
      longitude: -63.5744,
      zoom: 12,
      minYear: 2007,
      maxYear: 2010,
      bounds: new google.maps.LatLngBounds(new google.maps.LatLng(44.434570, -64.237190), new google.maps.LatLng(45.276489, -62.160469))
    }
  };

  WORST_ACCIDENT_RADIUS = 7;

  selectText = function(element) {
    var range, selection;
    if (document.body.createTextRange != null) {
      range = document.body.createTextRange();
      range.moveToElementText(element);
      return range.select();
    } else if (window.getSelection != null) {
      selection = window.getSelection();
      range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      return selection.addRange(range);
    }
  };

  State = (function() {

    function State(options) {
      if (options == null) options = {};
      this.city = options.city || 'toronto';
      this.mode = 'bicycling';
      this.origin = options.origin;
      this.destination = options.destination;
      this.minYear = this._clampYear('min', options.minYear || DEFAULT_MIN_YEAR);
      this.maxYear = this._clampYear('max', options.maxYear || DEFAULT_MAX_YEAR);
      this.routes = {};
      this.accidents = {};
      this.listeners = {};
    }

    State.prototype.onChange = function(key, callback) {
      var _base;
      (_base = this.listeners)[key] || (_base[key] = []);
      return this.listeners[key].push(callback);
    };

    State.prototype._changed = function(key, arg1, arg2) {
      var callback, callbacks, _i, _len, _results;
      if (arg1 == null) arg1 = void 0;
      if (arg2 == null) arg2 = void 0;
      callbacks = this.listeners[key] || [];
      _results = [];
      for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
        callback = callbacks[_i];
        _results.push(callback(arg1, arg2));
      }
      return _results;
    };

    State.prototype.setCity = function(city) {
      this.clearAccidents();
      this.clearRoutes();
      this.setDestination(void 0);
      this.setOrigin(void 0);
      this.city = city;
      return this._changed('city', this.city);
    };

    State.prototype.setMode = function(mode) {
      this.mode = mode;
      return this._changed('mode', this.mode);
    };

    State.prototype.setOrigin = function(latlng) {
      if (latlng === this.origin) return;
      this.clearAccidents();
      this.clearRoutes();
      this.origin = latlng;
      return this._changed('origin', this.origin);
    };

    State.prototype.setDestination = function(latlng) {
      if (latlng === this.destination) return;
      this.clearAccidents();
      this.clearRoutes();
      this.destination = latlng;
      return this._changed('destination', this.destination);
    };

    State.prototype._clampYear = function(minOrMax, year) {
      var clamp, property;
      property = "" + minOrMax + "Year";
      clamp = CITIES[this.city][property];
      if (!year) return clamp;
      if (minOrMax === 'min' && year < clamp) return clamp;
      if (minOrMax === 'max' && year > clamp) return clamp;
      return year;
    };

    State.prototype.setMinYear = function(year) {
      var clampedYear;
      clampedYear = this._clampYear('min', year);
      if (clampedYear !== this.minYear) {
        this.clearAccidents();
        this.minYear = clampedYear;
        return this._changed('minYear', this.minYear);
      }
    };

    State.prototype.setMaxYear = function(year) {
      var clampedYear;
      clampedYear = this._clampYear('max', year);
      if (clampedYear !== this.maxYear) {
        this.clearAccidents();
        this.maxYear = clampedYear;
        return this._changed('maxYear', this.maxYear);
      }
    };

    State.prototype.setRoute = function(key, directions) {
      this.clearAccidents();
      this.routes[key] = directions;
      return this._changed('routes', key, directions);
    };

    State.prototype.clearRoutes = function(key) {
      if (key == null) key = void 0;
      if (key) {
        delete this.routes[key];
        return this._changed('routes', key, void 0);
      } else {
        this.routes = {};
        return this._changed('routes');
      }
    };

    State.prototype.setAccidents = function(key, accidents) {
      this.accidents[key] = accidents;
      return this._changed('accidents', key, accidents);
    };

    State.prototype.clearAccidents = function(key) {
      if (key == null) key = void 0;
      if (key) {
        delete this.accidents[key];
        return this._changed('accidents', key, void 0);
      } else {
        this.accidents = {};
        return this._changed('accidents');
      }
    };

    return State;

  })();

  RouteFinder = (function() {

    function RouteFinder(state) {
      var _this = this;
      this.state = state;
      this.state.onChange('city', function() {
        return _this.refresh();
      });
      this.state.onChange('origin', function() {
        return _this.refresh();
      });
      this.state.onChange('destination', function() {
        return _this.refresh();
      });
      this.state.onChange('mode', function() {
        return _this.refresh();
      });
      this._activeRequestIds = {};
      this._activeRequestIds[google.maps.TravelMode.BICYCLING] = 0;
      this._activeRequestIds[google.maps.TravelMode.DRIVING] = 0;
    }

    RouteFinder.prototype._getCityBounds = function() {
      return CITIES[this.state.city].bounds;
    };

    RouteFinder.prototype._modeToGoogleModes = function(mode) {
      return {
        driving: [google.maps.TravelMode.DRIVING],
        bicycling: [google.maps.TravelMode.BICYCLING],
        both: [google.maps.TravelMode.BICYCLING, google.maps.TravelMode.DRIVING]
      }[mode];
    };

    RouteFinder.prototype._googleModeToMode = function(mode) {
      if (mode === google.maps.TravelMode.DRIVING) {
        return 'driving';
      } else {
        return 'bicycling';
      }
    };

    RouteFinder.prototype._getDirectionsRequestForMode = function(mode) {
      var googleMode, _i, _len, _ref, _results;
      _ref = _modeToGoogleModes(mode);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        googleMode = _ref[_i];
        _results.push(this._getDirectionsRequestForGoogleMode(googleMode));
      }
      return _results;
    };

    RouteFinder.prototype._getDirectionsRequestForGoogleMode = function(googleMode) {
      return {
        origin: this.state.origin,
        destination: this.state.destination,
        travelMode: googleMode,
        provideRouteAlternatives: false,
        unitSystem: google.maps.UnitSystem.METRIC,
        region: 'ca'
      };
    };

    RouteFinder.prototype._getDirectionsService = function() {
      return this.directionsService || (this.directionsService = new google.maps.DirectionsService());
    };

    RouteFinder.prototype.refresh = function() {
      var googleMode, request, requestId, service, _i, _len, _ref, _results,
        _this = this;
      if (!(this.state.origin != null) || !(this.state.destination != null)) {
        this.state.clearRoutes();
        return;
      }
      service = this._getDirectionsService();
      _ref = this._modeToGoogleModes(this.state.mode);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        googleMode = _ref[_i];
        request = this._getDirectionsRequestForGoogleMode(googleMode);
        requestId = (this._activeRequestIds[googleMode] += 1);
        _results.push(service.route(request, function(result, status) {
          return _this._receiveDirectionsResponse(googleMode, requestId, result, status);
        }));
      }
      return _results;
    };

    RouteFinder.prototype._receiveDirectionsResponse = function(googleMode, requestId, result, status) {
      var mode;
      if (this._activeRequestIds[googleMode] !== requestId) return;
      if (status !== google.maps.DirectionsStatus.OK) return;
      mode = this._googleModeToMode(googleMode);
      return this.state.setRoute(mode, result);
    };

    return RouteFinder;

  })();

  RouteRenderer = (function() {

    function RouteRenderer(state, map) {
      var mode, _i, _len, _ref,
        _this = this;
      this.state = state;
      this.renderers = {};
      this._blockingStateChanges = {};
      _ref = ['bicycling', 'driving'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        mode = _ref[_i];
        this._blockingStateChanges[mode] = false;
        this.renderers[mode] = this._createDirectionsRendererForMode(mode, map);
      }
      this.state.onChange('routes', function(mode, route) {
        var _j, _len2, _ref2, _results;
        _ref2 = mode && [mode] || ['bicycling', 'driving'];
        _results = [];
        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
          mode = _ref2[_j];
          if (_this._blockingStateChanges[mode]) continue;
          _this._blockingStateChanges[mode] = true;
          if (!(route != null)) {
            _this.renderers[mode].setMap(null);
          } else {
            _this.renderers[mode].setDirections(route);
            _this.renderers[mode].setMap(map);
          }
          _results.push(_this._blockingStateChanges[mode] = false);
        }
        return _results;
      });
    }

    RouteRenderer.prototype._createDirectionsRendererForMode = function(mode) {
      var color, renderer,
        _this = this;
      color = COLORS[mode];
      renderer = new google.maps.DirectionsRenderer({
        draggable: true,
        polylineOptions: {
          strokeColor: color
        },
        preserveViewport: true,
        suppressInfoWindows: true,
        suppressMarkers: true,
        suppressBicyclingLayer: true
      });
      google.maps.event.addListener(renderer, 'directions_changed', function() {
        if (_this._blockingStateChanges[mode]) return;
        _this._blockingStateChanges[mode] = true;
        _this.state.setRoute(mode, renderer.getDirections());
        return _this._blockingStateChanges[mode] = false;
      });
      return renderer;
    };

    return RouteRenderer;

  })();

  AccidentFinder = (function() {

    function AccidentFinder(state) {
      var _this = this;
      this.state = state;
      this._requests = {};
      this.state.onChange('routes', function() {
        return _this.refresh();
      });
      this.state.onChange('minYear', function() {
        return _this.refresh();
      });
      this.state.onChange('maxYear', function() {
        return _this.refresh();
      });
    }

    AccidentFinder.prototype.refresh = function() {
      var mode, _i, _len, _ref, _results;
      _ref = this.state.mode !== 'both' && [this.state.mode] || ['bicycling', 'driving'];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        mode = _ref[_i];
        _results.push(this._refreshAccidents(mode));
      }
      return _results;
    };

    AccidentFinder.prototype._refreshAccidents = function(mode) {
      var encodedPolyline, postData, route, url,
        _this = this;
      if (this._requests[mode] != null) {
        this._requests[mode].abort();
        delete this._requests[mode];
      }
      route = this.state.routes[mode];
      if (!(route != null)) return;
      encodedPolyline = route.routes[0].overview_polyline.points;
      postData = {
        min_date: "" + this.state.minYear + "-01-01",
        max_date: "" + this.state.maxYear + "-12-31",
        encoded_polyline: encodedPolyline
      };
      url = URL.replace(/%\{city}/, this.state.city);
      return this._requests[mode] = $.ajax({
        url: url,
        type: 'POST',
        data: postData,
        dataType: 'json',
        success: function(data) {
          delete _this._requests[mode];
          return _this.state.setAccidents(mode, data);
        }
      });
    };

    return AccidentFinder;

  })();

  ChartSeriesMaker = (function() {

    function ChartSeriesMaker() {
      this.data = {};
    }

    ChartSeriesMaker.prototype.add = function(year) {
      var y, _base;
      y = year.toString();
      (_base = this.data)[y] || (_base[y] = 0);
      return this.data[y] += 1;
    };

    ChartSeriesMaker.prototype.getSeries = function() {
      var k, v, _ref, _results;
      _ref = this.data;
      _results = [];
      for (k in _ref) {
        v = _ref[k];
        _results.push([+k, v]);
      }
      return _results;
    };

    return ChartSeriesMaker;

  })();

  Renderer = (function() {

    function Renderer() {}

    Renderer.prototype.clearAccidents = function(mode) {
      if (mode == null) mode = void 0;
      if (!(mode != null)) {
        return this.accidents = {};
      } else {
        return delete this.accidents[mode];
      }
    };

    Renderer.prototype.addAccidents = function(mode, accidents) {
      return this.accidents[mode] = accidents;
    };

    return Renderer;

  })();

  SummaryRenderer = (function(_super) {

    __extends(SummaryRenderer, _super);

    function SummaryRenderer(div) {
      this.div = div;
      this.accidents = {};
      this.status = 'no-input';
    }

    SummaryRenderer.prototype.setStatus = function(status) {
      this.status = status;
    };

    SummaryRenderer.prototype.render = function() {
      var bicycling, driving, html, nBicycling, nDriving;
      html = '';
      if (this.status === 'no-input') {
        html = 'Choose an origin and destination...';
      } else {
        bicycling = this.accidents.bicycling != null;
        driving = this.accidents.driving != null;
        if (bicycling) nBicycling = this.accidents.bicycling.length;
        if (driving) nDriving = this.accidents.driving.length;
        if (!bicycling && !driving) {
          html = 'Waiting for server...';
        } else {
          if (!bicycling) {
            html = 'Waiting for server for bicycling data...';
          } else if (!driving) {
            html = 'waiting for server for driving data...';
          } else if (nBicycling === 0 && nDriving !== 0) {
            html = "There have been <span class=\"driving\">" + nDriving + "</span> reported accidents involving cyclists along the <span class=\"driving\">driving</span> route and none for the <span class=\"bicycling\">bicycling</span> route.";
          } else if (nDriving === 0 && nBicycling !== 0) {
            html = "There have been <span class=\"bicycling\">" + nBicycling + "</span> reported accidents involving cyclists along the <span class=\"bicycling\">bicycling</span> route and none for the <span class=\"driving\">driving</span> route.";
          } else if (nDriving === 0 && nBicycling === 0) {
            html = "There have been no reported accidents involving cyclists along either the <span class=\"bicycling\">bicycling</span> or <span class=\"driving\">driving</span> routes.";
          } else {
            html = "There have been <span class=\"driving\">" + nDriving + "</span> reported accidents involving cyclists along the <span class=\"driving\">driving</span> route and <span class=\"bicycling\">" + nBicycling + "</span> along the <span class=\"bicycling\">bicycling</span> route.";
          }
        }
      }
      return $(this.div).html(html);
    };

    return SummaryRenderer;

  })(Renderer);

  AccidentsTableRenderer = (function(_super) {

    __extends(AccidentsTableRenderer, _super);

    function AccidentsTableRenderer(div) {
      this.div = div;
      this.accidents = {};
    }

    AccidentsTableRenderer.prototype.addAccidents = function(mode, accidents) {
      var accident, _i, _len;
      for (_i = 0, _len = accidents.length; _i < _len; _i++) {
        accident = accidents[_i];
        accident.distance_along_path = "" + accident.distance_along_path + "m (" + mode + ")";
      }
      return this.accidents[mode] = accidents;
    };

    AccidentsTableRenderer.prototype.render = function() {
      var $table, $tbody, $tds, $th, $theadTr, $tr, accident, accidents, heading, headings, i, key, keys, mode, modeAccidents, textNode, trClass, value, _i, _len, _len2, _len3, _ref, _ref2;
      accidents = [];
      _ref = this.accidents;
      for (mode in _ref) {
        modeAccidents = _ref[mode];
        accidents = accidents.concat(modeAccidents);
      }
      if (!(accidents.length > 0)) return;
      $table = $('<table><thead><tr><th class="distance_along_path">Odometer</th></tr></thead><tbody></tbody></table>');
      headings = [];
      _ref2 = accidents[0];
      for (heading in _ref2) {
        value = _ref2[heading];
        if (heading === 'id') continue;
        if (heading === 'distance_along_path') continue;
        if (heading === 'Time') continue;
        if (heading === 'Latitude') continue;
        if (heading === 'Longitude') continue;
        headings.push(heading);
      }
      headings.sort();
      headings.unshift('Time');
      keys = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = headings.length; _i < _len; _i++) {
          heading = headings[_i];
          _results.push(heading.toLowerCase().replace(/\s/g, '-'));
        }
        return _results;
      })();
      keys.unshift('distance_along_path');
      $theadTr = $table.find('thead').children();
      for (i = 0, _len = headings.length; i < _len; i++) {
        heading = headings[i];
        $th = $('<th></th>');
        $th.attr('class', keys[i + 1]);
        $th.text(heading);
        $theadTr.append($th);
      }
      $tbody = $table.find('tbody');
      trClass = 'odd';
      for (_i = 0, _len2 = accidents.length; _i < _len2; _i++) {
        accident = accidents[_i];
        $tr = $('<tr>' + [
          (function() {
            var _j, _len3, _results;
            _results = [];
            for (_j = 0, _len3 = keys.length; _j < _len3; _j++) {
              key = keys[_j];
              _results.push('<td></td>');
            }
            return _results;
          })()
        ].join('') + '</tr>');
        $tr.attr('class', trClass);
        $tr.attr('id', "accident-" + accident.id);
        $tds = $tr.children();
        if (trClass === 'odd') {
          trClass = 'even';
        } else {
          trClass = 'odd';
        }
        for (i = 0, _len3 = keys.length; i < _len3; i++) {
          key = keys[i];
          heading = headings[i - 1];
          $tds[i].className = key;
          textNode = document.createTextNode(accident[heading] || accident[key] || '');
          $tds[i].appendChild(textNode);
        }
        mode = /bicycling/.test(accident.distance_along_path) && 'bicycling' || 'driving';
        $tds[0].className += " " + mode;
        $tbody.append($tr);
      }
      $table.on('dblclick', function(e) {
        return selectText($dataDiv[0]);
      });
      $(this.div).empty();
      return $(this.div).append($table);
    };

    return AccidentsTableRenderer;

  })(Renderer);

  TrendChartRenderer = (function() {

    function TrendChartRenderer(div) {
      this.div = div;
      this.series = {};
    }

    TrendChartRenderer.prototype.clearAccidents = function(mode) {
      if (mode == null) mode = void 0;
      if (!(mode != null)) {
        return this.series = {};
      } else {
        return delete this.series[mode];
      }
    };

    TrendChartRenderer.prototype.addAccidents = function(mode, accidents) {
      var accident, seriesMaker, _i, _len;
      if (accidents.length === 0) {
        delete this.series[mode];
        return;
      }
      seriesMaker = new ChartSeriesMaker();
      for (_i = 0, _len = accidents.length; _i < _len; _i++) {
        accident = accidents[_i];
        seriesMaker.add(accident.Time.split('-')[0]);
      }
      return this.series[mode] = seriesMaker.getSeries();
    };

    TrendChartRenderer.prototype.render = function() {
      var color, innerId, mode, plotSeries, plotSeriesOptions, series, _ref;
      plotSeries = [];
      plotSeriesOptions = [];
      _ref = this.series;
      for (mode in _ref) {
        series = _ref[mode];
        color = COLORS[mode];
        plotSeries.push(series);
        plotSeriesOptions.push({
          color: color
        });
      }
      if (!(plotSeries.length > 0)) return;
      innerId = "" + this.div.id + "-chartInner";
      $(this.div).empty();
      $(this.div).append("<div id=\"" + innerId + "\"></div>");
      return $.jqplot(innerId, plotSeries, {
        highlighter: {
          show: true,
          sizeAdjust: 8
        },
        cursor: {
          show: false
        },
        axes: {
          xaxis: {
            max: 2012,
            tickInterval: 1
          },
          yaxis: {
            min: 0,
            tickInterval: 2
          }
        },
        series: plotSeriesOptions
      });
    };

    return TrendChartRenderer;

  })();

  AccidentsMarkerRenderer = (function() {

    function AccidentsMarkerRenderer(map) {
      var calculateMarkerStyleIndex, clusterUrlRoot, iconStyles, makeIconStyle;
      this.map = map;
      this.markerArrays = {};
      iconStyles = [];
      clusterUrlRoot = "" + window.location.protocol + "//" + window.location.host + (window.location.pathname.replace(/[^\/]*$/, '')) + "/icons";
      calculateMarkerStyleIndex = function(markers, nIconStyles) {
        var accidentsPath, accidentsPathToSmallestIconIndex, iconIndexAddition, index, marker, text, _i, _len;
        accidentsPath = void 0;
        for (_i = 0, _len = markers.length; _i < _len; _i++) {
          marker = markers[_i];
          if (!(accidentsPath != null)) accidentsPath = marker.accidentPath;
          if (accidentsPath !== marker.accidentPath) {
            accidentsPath = 'both';
            break;
          }
        }
        accidentsPathToSmallestIconIndex = {
          driving: 0,
          bicycling: 3,
          both: 6
        };
        iconIndexAddition = 0;
        if (markers.length > 1) iconIndexAddition += 1;
        if (markers.length > 3) iconIndexAddition += 1;
        text = "" + markers.length;
        if (markers.length === 1) text = '1';
        index = accidentsPathToSmallestIconIndex[accidentsPath] + iconIndexAddition;
        return {
          text: text,
          index: index + 1
        };
      };
      makeIconStyle = function(mode, index, size) {
        return {
          width: size,
          height: size,
          textSize: size - 4,
          url: "" + clusterUrlRoot + "/cluster-" + mode + "-" + (index + 1) + ".png"
        };
      };
      iconStyles = [makeIconStyle('driving', 0, 13), makeIconStyle('driving', 1, 15), makeIconStyle('driving', 2, 17), makeIconStyle('bicycling', 0, 13), makeIconStyle('bicycling', 1, 15), makeIconStyle('bicycling', 2, 17), makeIconStyle('both', 0, 13), makeIconStyle('both', 1, 15), makeIconStyle('both', 2, 17)];
      this.clusterer = new MarkerClusterer(this.map, [], {
        averageCenter: true,
        gridSize: 15,
        styles: iconStyles,
        calculator: calculateMarkerStyleIndex,
        minimumClusterSize: 1,
        printable: true,
        zoomOnClick: false
      });
    }

    AccidentsMarkerRenderer.prototype.clearAccidents = function(mode) {
      var accidents, _ref;
      if (mode == null) mode = void 0;
      if (!(mode != null)) {
        _ref = this.markerArrays;
        for (mode in _ref) {
          accidents = _ref[mode];
          this.clearAccidents(mode);
        }
        return;
      }
      if (!this.markerArrays[mode]) return;
      this.clusterer.removeMarkers(this.markerArrays[mode]);
      return delete this.markerArrays[mode];
    };

    AccidentsMarkerRenderer.prototype.addAccidents = function(mode, accidents) {
      var accident, accidentKeyToMode, key, latLng, latitude, longitude, marker, markers, _, _i, _j, _k, _len, _len2, _len3, _ref, _ref2;
      this.clearAccidents(mode);
      if (accidents.length === 0) return;
      this.markerArrays[mode] = [];
      for (_i = 0, _len = accidents.length; _i < _len; _i++) {
        accident = accidents[_i];
        latitude = accident.Latitude;
        longitude = accident.Longitude;
        latLng = new google.maps.LatLng(latitude, longitude);
        marker = new google.maps.Marker({
          position: latLng,
          flat: true
        });
        marker.accidentUniqueKey = "" + latitude + "|" + longitude + "|" + accident.Time;
        this.markerArrays[mode].push(marker);
      }
      accidentKeyToMode = {};
      _ref = this.markerArrays;
      for (mode in _ref) {
        markers = _ref[mode];
        for (_j = 0, _len2 = markers.length; _j < _len2; _j++) {
          marker = markers[_j];
          key = marker.accidentUniqueKey;
          if ((accidentKeyToMode[key] != null) && accidentKeyToMode[key] !== mode) {
            accidentKeyToMode[key] = 'both';
          } else {
            accidentKeyToMode[key] = mode;
          }
        }
      }
      _ref2 = this.markerArrays;
      for (_ in _ref2) {
        markers = _ref2[_];
        for (_k = 0, _len3 = markers.length; _k < _len3; _k++) {
          marker = markers[_k];
          key = marker.accidentUniqueKey;
          marker.accidentPath = accidentKeyToMode[key];
        }
      }
      this.clusterer.addMarkers(this.markerArrays[mode], true);
      return this.clusterer.repaint();
    };

    AccidentsMarkerRenderer.prototype.render = function() {};

    return AccidentsMarkerRenderer;

  })();

  WorstLocationsRenderer = (function() {

    function WorstLocationsRenderer(div) {
      this.div = div;
      this.topGroups = {};
      this.maxLocations = 3;
    }

    WorstLocationsRenderer.prototype.clearAccidents = function(mode) {
      if (mode == null) mode = void 0;
      if (!(mode != null)) {
        return this.topGroups = {};
      } else {
        return delete this.topGroups[mode];
      }
    };

    WorstLocationsRenderer.prototype.addAccidents = function(mode, accidents) {
      var a, accident, d, distance_along_path, i, objs, results, sorted, topGroup, _i, _j, _len, _len2, _len3, _ref, _ref2, _ref3, _ref4, _ref5;
      objs = [];
      results = [];
      for (_i = 0, _len = accidents.length; _i < _len; _i++) {
        accident = accidents[_i];
        distance_along_path = +('' + accident.distance_along_path).replace(/[^\d]*/g, '');
        for (d = _ref = distance_along_path - WORST_ACCIDENT_RADIUS, _ref2 = distance_along_path + WORST_ACCIDENT_RADIUS; _ref <= _ref2 ? d <= _ref2 : d >= _ref2; _ref <= _ref2 ? d++ : d--) {
          if (d < 0) continue;
          objs[d] || (objs[d] = []);
          objs[d].push(accident);
        }
      }
      sorted = objs.slice();
      while (results.length < this.maxLocations) {
        sorted.sort(function(a, b) {
          return b.length - a.length;
        });
        if (sorted.length === 0 || sorted[0].length === 0) break;
        topGroup = sorted[0].slice();
        results.push(topGroup);
        for (_j = 0, _len2 = topGroup.length; _j < _len2; _j++) {
          accident = topGroup[_j];
          distance_along_path = +('' + accident.distance_along_path).replace(/[^\d]*/g, '');
          for (d = _ref3 = distance_along_path - WORST_ACCIDENT_RADIUS, _ref4 = distance_along_path + WORST_ACCIDENT_RADIUS; _ref3 <= _ref4 ? d <= _ref4 : d >= _ref4; _ref3 <= _ref4 ? d++ : d--) {
            if (d < 0 || d >= objs.length) continue;
            _ref5 = objs[d];
            for (i = 0, _len3 = _ref5.length; i < _len3; i++) {
              a = _ref5[i];
              if (a.distance_along_path === accident.distance_along_path) {
                objs[d].splice(i, 1);
                break;
              }
            }
          }
        }
      }
      return this.topGroups[mode] = results;
    };

    WorstLocationsRenderer.prototype.getTopGroups = function() {
      var accident, idToGroup, mode, topGroup, topGroups, topGroupsTotal, totalTopGroup, _i, _j, _k, _len, _len2, _len3, _ref;
      idToGroup = {};
      topGroupsTotal = [];
      _ref = this.topGroups;
      for (mode in _ref) {
        topGroups = _ref[mode];
        for (_i = 0, _len = topGroups.length; _i < _len; _i++) {
          topGroup = topGroups[_i];
          totalTopGroup = void 0;
          for (_j = 0, _len2 = topGroup.length; _j < _len2; _j++) {
            accident = topGroup[_j];
            if (idToGroup[accident.id] != null) {
              totalTopGroup = idToGroup[accident.id];
              totalTopGroup.mode = 'both';
              break;
            }
          }
          if (!(totalTopGroup != null)) {
            totalTopGroup = {
              mode: mode,
              accidents: []
            };
            topGroupsTotal.push(totalTopGroup);
          }
          for (_k = 0, _len3 = topGroup.length; _k < _len3; _k++) {
            accident = topGroup[_k];
            if (!(idToGroup[accident.id] != null)) {
              idToGroup[accident.id] = totalTopGroup;
              totalTopGroup.accidents.push(accident);
            }
          }
        }
      }
      topGroupsTotal.sort(function(a, b) {
        return b.length - a.length;
      });
      return topGroupsTotal.slice(0, 3);
    };

    WorstLocationsRenderer.prototype.groupToSpot = function(group) {
      var accident, sumLatitude, sumLongitude, _i, _len, _ref;
      sumLatitude = 0;
      sumLongitude = 0;
      _ref = group.accidents;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        accident = _ref[_i];
        sumLatitude += accident.Latitude;
        sumLongitude += accident.Longitude;
      }
      return {
        Latitude: sumLatitude / group.accidents.length,
        Longitude: sumLongitude / group.accidents.length,
        mode: group.mode,
        accidents: group.accidents
      };
    };

    WorstLocationsRenderer.prototype.getTopSpots = function() {
      var group, _i, _len, _ref, _results;
      _ref = this.getTopGroups();
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        group = _ref[_i];
        _results.push(this.groupToSpot(group));
      }
      return _results;
    };

    WorstLocationsRenderer.prototype.getHeadingString = function(topSpots) {
      var locations, routes;
      locations = topSpots.length === 1 && 'location' || 'locations';
      routes = (this.topGroups.bicycling != null) && (this.topGroups.driving != null) && 'routes' || 'route';
      return "Most accident-prone " + locations + " along your " + routes;
    };

    WorstLocationsRenderer.prototype.getTopSpotString = function(topSpot) {
      var accidents;
      accidents = topSpot.accidents.length > 0 && 'accidents' || 'accident';
      if (topSpot.mode === 'both') {
        return "" + topSpot.accidents.count + " " + accidents + " along your driving and bicycling routes";
      } else {
        return "" + topSpot.accidents.count + " " + accidents + " along your " + topSpot.mode + " route";
      }
    };

    WorstLocationsRenderer.prototype.getGeocoder = function() {
      return this.geocoder || (this.geocoder = new google.maps.Geocoder());
    };

    WorstLocationsRenderer.prototype.renderTopSpot = function(topSpot) {
      var $html,
        _this = this;
      $html = $('<li><div class="image-container"><img src="" alt="" /></div><div class="address"></div><div class="count"></div></li>');
      $html.find('.address').text("" + topSpot.Latitude + "," + topSpot.Longitude);
      $html.find('.count').text(this.getTopSpotString(topSpot));
      this.getGeocoder().geocode({
        latLng: new google.maps.LatLng(topSpot.Latitude, topSpot.Longitude)
      }, function(results, status) {
        if (status === google.maps.GeocoderStatus.OK) {
          return $html.find('.address').text(results[0].address_components[0].long_name);
        }
      });
      window.setTimeout(function() {
        var $img, url;
        $img = $html.find('img');
        url = "http://maps.googleapis.com/maps/api/streetview?sensor=false&size=" + ($img.width()) + "x" + ($img.height()) + "&location=" + topSpot.Latitude + "," + topSpot.Longitude;
        return $img.attr('src', url);
      }, 50);
      return $html;
    };

    WorstLocationsRenderer.prototype.render = function() {
      var $div, $h2, $li, $ul, h2String, i, topSpot, topSpots, _len;
      $div = $(this.div);
      topSpots = this.getTopSpots();
      if (!topSpots.length) {
        $div.hide();
        return;
      }
      h2String = this.getHeadingString(topSpots);
      $div.empty();
      $h2 = $('<h2></h2>');
      $h2.text(h2String);
      $div.append($h2);
      $ul = $('<ul></ul>');
      for (i = 0, _len = topSpots.length; i < _len; i++) {
        topSpot = topSpots[i];
        $li = this.renderTopSpot(topSpot, i);
        $li.addClass("top-spot-" + i);
        $ul.append($li);
      }
      return $div.append($ul);
    };

    return WorstLocationsRenderer;

  })();

  Manager = (function() {

    function Manager(map, origin, destination, city, summaryDiv, chartDiv, dataDiv, worstLocationsDiv, options) {
      var accidentFinder, routeFinder, routeRenderer,
        _this = this;
      this.map = map;
      this.origin = origin;
      this.destination = destination;
      this.city = city;
      if (options == null) options = void 0;
      this.state = new State({
        city: this.city,
        origin: this.origin,
        destination: this.destination,
        minYear: (options != null) && options.minYear,
        maxYear: (options != null) && options.maxYear
      });
      this.setCity(this.city);
      routeFinder = new RouteFinder(this.state);
      routeRenderer = new RouteRenderer(this.state, this.map);
      accidentFinder = new AccidentFinder(this.state);
      this.summaryRenderer = new SummaryRenderer(summaryDiv);
      this.summaryRenderer.setStatus('no-input');
      this.summaryRenderer.render();
      this.tableRenderer = new AccidentsTableRenderer(dataDiv);
      this.chartRenderer = new TrendChartRenderer(chartDiv);
      this.markerRenderer = new AccidentsMarkerRenderer(this.map);
      this.worstLocationsRenderer = new WorstLocationsRenderer(worstLocationsDiv);
      this.state.onChange('accidents', function(mode, accidents) {
        _this.summaryRenderer.clearAccidents();
        _this.tableRenderer.clearAccidents();
        _this.chartRenderer.clearAccidents();
        _this.markerRenderer.clearAccidents();
        _this.worstLocationsRenderer.clearAccidents();
        if (accidents != null) {
          _this.summaryRenderer.addAccidents(mode, accidents);
          _this.tableRenderer.addAccidents(mode, accidents);
          _this.chartRenderer.addAccidents(mode, accidents);
          _this.markerRenderer.addAccidents(mode, accidents);
          _this.worstLocationsRenderer.addAccidents(mode, accidents);
        }
        _this.summaryRenderer.render();
        _this.tableRenderer.render();
        _this.chartRenderer.render();
        _this.markerRenderer.render();
        return _this.worstLocationsRenderer.render();
      });
    }

    Manager.prototype.setCity = function(city) {
      var latlng, zoom, zoomData;
      this.city = city;
      this.state.setCity(city);
      zoomData = CITIES[this.city];
      latlng = new google.maps.LatLng(zoomData.latitude, zoomData.longitude);
      zoom = zoomData.zoom;
      this.map.setCenter(latlng);
      return this.map.setZoom(zoom);
    };

    Manager.prototype.getCityYearRange = function() {
      var cityData;
      cityData = CITIES[this.city];
      return [cityData.minYear, cityData.maxYear];
    };

    Manager.prototype.getYearRange = function() {
      return [this.state.minYear, this.state.maxYear];
    };

    Manager.prototype.setMinYear = function(year) {
      return this.state.setMinYear(year);
    };

    Manager.prototype.setMaxYear = function(year) {
      return this.state.setMaxYear(year);
    };

    Manager.prototype.getCityBounds = function() {
      return CITIES[this.city].bounds;
    };

    Manager.prototype.setOrigin = function(origin) {
      this.origin = origin;
      if (this.origin) {
        if (!(this.originMarker != null)) {
          this.originMarker = new google.maps.Marker({
            position: this.origin,
            map: this.map
          });
        } else {
          this.originMarker.setPosition(this.origin);
        }
      } else {
        if (this.originMarker != null) {
          this.originMarker.setMap(null);
          delete this.originMarker;
        }
      }
      return this.state.setOrigin(this.origin);
    };

    Manager.prototype.setDestination = function(destination) {
      this.destination = destination;
      if (this.destination) {
        if (!(this.destinationMarker != null)) {
          this.destinationMarker = new google.maps.Marker({
            position: this.destination,
            map: this.map
          });
        } else {
          this.destinationMarker.setPosition(this.destination);
        }
      } else {
        if (this.destinationMarker != null) {
          this.destinationMarker.setMap(null);
          delete this.destinationMarker;
        }
      }
      return this.state.setDestination(this.destination);
    };

    return Manager;

  })();

  window.Manager = Manager;

  make_expander = function(div) {
    var $h2;
    $h2 = $(div).children('h2');
    return $h2.on('click', function(e) {
      var $inner;
      $inner = $(div).children('div');
      if ($inner.is(':visible')) {
        return $inner.hide();
      } else {
        return $inner.show();
      }
    });
  };

  $.fn.expander = function() {
    return $.each(this, function() {
      return make_expander(this);
    });
  };

  AddressSearchForm = (function() {

    function AddressSearchForm(form, originOrDestination, manager) {
      var $form,
        _this = this;
      this.originOrDestination = originOrDestination;
      this.manager = manager;
      $form = $(form);
      this.$a = $form.find('a');
      this.aText = this.$a.text();
      this.$input = $form.find('input[type=text]');
      this.$status = $form.find('div.status');
      this.$error = $form.find('div.error');
      this.lastAddressTyped = this.$input.val();
      this.mapListener = void 0;
      $form.on('submit', function(e) {
        e.stopPropagation();
        e.preventDefault();
        return _this.onAddressTyped();
      });
      this.$a.on('click', function(e) {
        var $a;
        $a = $(e.target);
        e.stopPropagation();
        e.preventDefault();
        if (_this.mapListener != null) {
          google.maps.event.removeListener(_this.mapListener);
          _this.mapListener = void 0;
          return _this.setClickingOnMap(false);
        } else {
          _this.mapListener = google.maps.event.addListenerOnce(_this.manager.map, 'click', function(e) {
            _this.mapListener = void 0;
            _this.setClickingOnMap(false);
            return _this.onAddressClicked(e.latLng);
          });
          return _this.setClickingOnMap(true);
        }
      });
    }

    AddressSearchForm.prototype.setClickingOnMap = function(clickingOnMap) {
      if (clickingOnMap) {
        this.$a.text('Click a point on the map to choose it');
        return this.$a.addClass('clicking');
      } else {
        this.$a.text(this.aText);
        return this.$a.removeClass('clicking');
      }
    };

    AddressSearchForm.prototype.getGeocoder = function() {
      return this.geocoder || (this.geocoder = new google.maps.Geocoder());
    };

    AddressSearchForm.prototype.onAddressTyped = function() {
      var addressTyped,
        _this = this;
      addressTyped = this.$input.val();
      if (addressTyped === this.lastAddressTyped) return;
      this.setError(void 0);
      if ($.trim(addressTyped || '')) {
        this.setStatus('Looking up address');
        this.lastAddressTyped = addressTyped;
        return this.getGeocoder().geocode({
          'address': addressTyped,
          'bounds': this.manager.getCityBounds()
        }, function(results, status) {
          return _this.onAddressGeocoded(results, status);
        });
      } else {
        this.setStatus(void 0);
        return this.setLatLng(void 0);
      }
    };

    AddressSearchForm.prototype.setStatus = function(status) {
      this.$status.text(status || '');
      if (status != null) {
        return this.$status.show();
      } else {
        return this.$status.hide();
      }
    };

    AddressSearchForm.prototype.setError = function(error) {
      this.$error.text(error || '');
      if (error != null) {
        return this.$error.show();
      } else {
        return this.$error.hide();
      }
    };

    AddressSearchForm.prototype.onAddressClicked = function(latlng) {
      var _this = this;
      this.setLatLng(latlng);
      this.setError(void 0);
      if (latlng != null) {
        this.setStatus('Finding address');
        this.$input.val('…');
        return this.getGeocoder().geocode({
          latLng: latlng
        }, function(results, status) {
          return _this.onLatLngGeocoded(results, status);
        });
      } else {
        this.$input.val('');
        return this.setStatus(void 0);
      }
    };

    AddressSearchForm.prototype.setLatLng = function(latlng) {
      var bounds;
      if (this.originOrDestination === 'origin') {
        this.manager.setOrigin(latlng);
      } else {
        this.manager.setDestination(latlng);
      }
      if (latlng != null) {
        bounds = this.manager.map.getBounds();
        if (!bounds.contains(latlng)) {
          bounds.extend(latlng);
          return this.manager.map.fitBounds(bounds);
        }
      }
    };

    AddressSearchForm.prototype.onAddressGeocoded = function(results, status) {
      var cityBounds;
      this.setStatus(void 0);
      cityBounds = this.manager.getCityBounds();
      if (status === google.maps.GeocoderStatus.ZERO_RESULTS || (status === google.maps.GeocoderStatus.OK && !cityBounds.contains(results[0].geometry.location))) {
        this.setError('Address not found');
        return this.setLatLng(null);
      } else if (status === google.maps.GeocoderStatus.OK) {
        return this.setLatLng(results[0].geometry.location);
      } else {
        this.setError('Failed to look up address');
        return this.setLatLng(null);
      }
    };

    AddressSearchForm.prototype.onLatLngGeocoded = function(results, status) {
      this.setStatus(void 0);
      if (status === google.maps.GeocoderStatus.OK) {
        return this.$input.val(results[0].formatted_address);
      } else {
        return this.$input.val('(point on map)');
      }
    };

    return AddressSearchForm;

  })();

  $.fn.address_search_form = function(originOrDestination, manager) {
    return $.each(this, function() {
      return new AddressSearchForm(this, originOrDestination, manager);
    });
  };

}).call(this);
