URL = 'http://localhost:8000/%{city}'
DEFAULT_MIN_YEAR = 2007
DEFAULT_MAX_YEAR = 2011

COLORS = {
  driving: '#cccc00',
  bicycling: '#00cc00',
  both: '#77cc00',
}

CITIES = {
  vancouver: {
    latitude: 49.2505,
    longitude: -123.1119,
    zoom: 12,
    minYear: 2006,
    maxYear: 2010,
    bounds: new google.maps.LatLngBounds(
      new google.maps.LatLng(49.131859, -123.264954),
      new google.maps.LatLng(49.352188, -122.985718)
    ),
  },
  calgary: {
    latitude: 51.0451,
    longitude: -114.0569,
    zoom: 12,
    minYear: 1996,
    maxYear: 2011,
    bounds: new google.maps.LatLngBounds(
      new google.maps.LatLng(50.842941, -114.613968),
      new google.maps.LatLng(51.343868, -113.901817)
    ),
  },
  toronto: {
    latitude: 43.6517,
    longitude: -79.3827,
    zoom: 13,
    minYear: 1986,
    maxYear: 2010,
    bounds: new google.maps.LatLngBounds(
      new google.maps.LatLng(43.584740, -79.639297),
      new google.maps.LatLng(43.855419, -79.115623)
    ),
  },
  ottawa: {
    latitude: 45.4214,
    longitude: -75.6919,
    zoom: 12,
    minYear: 2001,
    maxYear: 2010,
    bounds: new google.maps.LatLngBounds(
      new google.maps.LatLng(44.962002, -76.355766),
      new google.maps.LatLng(45.536541, -75.246033)
    ),
  },
  montreal: {
    latitude: 45.5081,
    longitude: -73.5550,
    zoom: 13,
    minYear: 2006,
    maxYear: 2010,
    bounds: new google.maps.LatLngBounds(
      new google.maps.LatLng(45.413479, -73.976608),
      new google.maps.LatLng(45.704788, -73.476418)
    ),
  },
  halifax: {
    latitude: 44.6479,
    longitude: -63.5744,
    zoom: 12,
    minYear: 2007,
    maxYear: 2010,
    bounds: new google.maps.LatLngBounds(
      new google.maps.LatLng(44.434570, -64.237190),
      new google.maps.LatLng(45.276489, -62.160469)
    ),
  },
}

WORST_ACCIDENT_RADIUS = 7 # metres.
# Two accidents can be double this apart and count as one location.

selectText = (element) ->
  if document.body.createTextRange?
    range = document.body.createTextRange()
    range.moveToElementText(element)
    range.select()
  else if window.getSelection?
    selection = window.getSelection()
    range = document.createRange()
    range.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(range)

class State
  constructor: (options = {}) ->
    @city = options.city || 'toronto'
    @mode = 'bicycling'
    @origin = options.origin
    @destination = options.destination
    @routes = {} # keyed by 'bicycling' and 'driving'
    @accidents = {} # keyed by 'bicycling' and 'driving'
    @listeners = {}
    # @routes is always set before @accidents

  onChange: (key, callback) ->
    @listeners[key] ||= []
    @listeners[key].push(callback)

  _changed: (key, arg1 = undefined, arg2 = undefined) ->
    callbacks = @listeners[key] || []
    for callback in callbacks
      callback(arg1, arg2)

  setCity: (city) ->
    this.clearAccidents()
    this.clearRoutes()
    this.setDestination(undefined)
    this.setOrigin(undefined)
    @city = city
    this._changed('city', @city)

  setMode: (mode) ->
    @mode = mode
    this._changed('mode', @mode)

  setOrigin: (latlng) ->
    return if latlng == @origin
    this.clearAccidents()
    this.clearRoutes()
    @origin = latlng
    this._changed('origin', @origin)

  setDestination: (latlng) ->
    return if latlng == @destination
    this.clearAccidents()
    this.clearRoutes()
    @destination = latlng
    this._changed('destination', @destination)

  setRoute: (key, directions) ->
    this.clearAccidents()
    this.routes[key] = directions
    this._changed('routes', key, directions)

  clearRoutes: (key=undefined) ->
    if key
      delete this.routes[key]
      this._changed('routes', key, undefined)
    else
      this.routes = {}
      this._changed('routes')

  setAccidents: (key, accidents) ->
    this.accidents[key] = accidents
    this._changed('accidents', key, accidents)

  clearAccidents: (key=undefined) ->
    if key
      delete this.accidents[key]
      this._changed('accidents', key, undefined)
    else
      this.accidents = {}
      this._changed('accidents')

class RouteFinder
  constructor: (@state) ->
    @state.onChange('city', () => this.refresh())
    @state.onChange('origin', () => this.refresh())
    @state.onChange('destination', () => this.refresh())
    @state.onChange('mode', () => this.refresh())
    @_activeRequestIds = {}
    @_activeRequestIds[google.maps.TravelMode.BICYCLING] = 0
    @_activeRequestIds[google.maps.TravelMode.DRIVING] = 0

  _getCityBounds: () ->
    CITIES[@state.city].bounds

  _modeToGoogleModes: (mode) ->
    {
      driving: [ google.maps.TravelMode.DRIVING ],
      bicycling: [ google.maps.TravelMode.BICYCLING ],
      both: [ google.maps.TravelMode.BICYCLING, google.maps.TravelMode.DRIVING ],
    }[mode]

  _googleModeToMode: (mode) ->
    if mode == google.maps.TravelMode.DRIVING
      return 'driving'
    else
      return 'bicycling'

  _getDirectionsRequestForMode: (mode) ->
    for googleMode in _modeToGoogleModes(mode)
      this._getDirectionsRequestForGoogleMode(googleMode)

  _getDirectionsRequestForGoogleMode: (googleMode) ->
    {
      origin: @state.origin,
      destination: @state.destination,
      travelMode: googleMode,
      provideRouteAlternatives: false,
      unitSystem: google.maps.UnitSystem.METRIC,
      region: 'ca',
    }

  _getDirectionsService: () ->
    @directionsService ||= new google.maps.DirectionsService()

  refresh: () ->
    if !@state.origin? || !@state.destination?
      @state.clearRoutes()
      return

    service = this._getDirectionsService()
    for googleMode in this._modeToGoogleModes(@state.mode)
      request = this._getDirectionsRequestForGoogleMode(googleMode)
      requestId = (@_activeRequestIds[googleMode] += 1)
      service.route request, (result, status) =>
        this._receiveDirectionsResponse(googleMode, requestId, result, status)

  _receiveDirectionsResponse: (googleMode, requestId, result, status) ->
    return if @_activeRequestIds[googleMode] != requestId
    return if status != google.maps.DirectionsStatus.OK # FIXME handle error

    mode = this._googleModeToMode(googleMode)
    @state.setRoute(mode, result)

class RouteRenderer
  constructor: (@state, map) ->
    @renderers = {}
    @_blockingStateChanges = {}
    for mode in [ 'bicycling', 'driving' ]
      @_blockingStateChanges[mode] = false
      @renderers[mode] = this._createDirectionsRendererForMode(mode, map)

    @state.onChange 'routes', (mode, route) =>
      # mode is undefined if we're clearing both
      for mode in (mode && [mode] || ['bicycling', 'driving'])
        continue if @_blockingStateChanges[mode]
        @_blockingStateChanges[mode] = true
        if !route?
          @renderers[mode].setMap(null)
        else
          @renderers[mode].setDirections(route)
          @renderers[mode].setMap(map)
        @_blockingStateChanges[mode] = false

  _createDirectionsRendererForMode: (mode) ->
    color = COLORS[mode]

    renderer = new google.maps.DirectionsRenderer({
      draggable: true,
      polylineOptions: { strokeColor: color },
      preserveViewport: true,
      suppressInfoWindows: true,
      suppressMarkers: true,
      suppressBicyclingLayer: true,
    })
    google.maps.event.addListener renderer, 'directions_changed', () =>
      return if @_blockingStateChanges[mode]
      @_blockingStateChanges[mode] = true
      @state.setRoute(mode, renderer.getDirections())
      @_blockingStateChanges[mode] = false
    renderer

class ChartSeriesMaker
  constructor: () ->
    @data = {}

  add: (year) ->
    y = year.toString()
    @data[y] ||= 0
    @data[y] += 1

  getSeries: () ->
    ([ +k, v ] for k, v of @data)

class Renderer
  clearAccidents: (mode = undefined) ->
    if !mode?
      @accidents = {}
    else
      delete @accidents[mode]

  addAccidents: (mode, accidents) ->
    @accidents[mode] = accidents

class SummaryRenderer extends Renderer
  constructor: (@div) ->
    @accidents = {}
    @status = 'no-input'

  setStatus: (@status) ->

  render: () ->
    html = ''

    if @status == 'no-input'
      html = 'Choose an origin and destination...'
    else
      bicycling = @accidents.bicycling?
      driving = @accidents.driving?

      nBicycling = @accidents.bicycling.length if bicycling
      nDriving = @accidents.driving.length if driving

      if !bicycling and !driving
        html = 'Waiting for server...'
      else
        if !bicycling
          html = 'Waiting for server for bicycling data...'
        else if !driving
          html = 'waiting for server for driving data...'
        else if nBicycling == 0 && nDriving != 0
          html = "There have been <span class=\"driving\">#{nDriving}</span> reported accidents involving cyclists along the <span class=\"driving\">driving</span> route and none for the <span class=\"bicycling\">bicycling</span> route."
        else if nDriving == 0 && nBicycling != 0
          html = "There have been <span class=\"bicycling\">#{nBicycling}</span> reported accidents involving cyclists along the <span class=\"bicycling\">bicycling</span> route and none for the <span class=\"driving\">driving</span> route."
        else if nDriving == 0 && nBicycling == 0
          html = "There have been no reported accidents involving cyclists along either the <span class=\"bicycling\">bicycling</span> or <span class=\"driving\">driving</span> routes."
        else
          html = "There have been <span class=\"driving\">#{nDriving}</span> reported accidents involving cyclists along the <span class=\"driving\">driving</span> route and <span class=\"bicycling\">#{nBicycling}</span> along the <span class=\"bicycling\">bicycling</span> route."

    $(@div).html(html)

class AccidentsTableRenderer extends Renderer
  constructor: (@div) ->
    @accidents = {}

  addAccidents: (mode, accidents) ->
    for accident in accidents
      accident.distance_along_path = "#{accident.distance_along_path}m (#{mode})"

    @accidents[mode] = accidents

  render: () ->
    accidents = []
    for mode, modeAccidents of @accidents
      accidents = accidents.concat(modeAccidents)

    return unless accidents.length > 0

    $table = $('<table><thead><tr><th class="distance_along_path">Odometer</th></tr></thead><tbody></tbody></table>')

    headings = []

    for heading, value of accidents[0]
      continue if heading == 'id'
      continue if heading == 'distance_along_path'
      continue if heading == 'Time'

      # We can't give Google-provided geocoded data
      # TODO: make exception for Toronto?
      continue if heading == 'Latitude'
      continue if heading == 'Longitude'
      headings.push(heading)

    headings.sort()
    headings.unshift('Time')

    keys = ( heading.toLowerCase().replace(/\s/g, '-') for heading in headings )
    keys.unshift('distance_along_path')

    $theadTr = $table.find('thead').children()
    for heading, i in headings
      $th = $('<th></th>')
      $th.attr('class', keys[i+1])
      $th.text(heading)
      $theadTr.append($th)

    $tbody = $table.find('tbody')
    trClass = 'odd'

    for accident in accidents
      $tr = $('<tr>' + ['<td></td>' for key in keys].join('') + '</tr>')
      $tr.attr('class', trClass)
      $tr.attr('id', "accident-#{accident.id}")
      $tds = $tr.children()

      if trClass == 'odd' then trClass = 'even' else trClass = 'odd'

      for key, i in keys
        heading = headings[i-1]
        $tds[i].className = key
        textNode = document.createTextNode(accident[heading] || accident[key] || '')
        $tds[i].appendChild(textNode)

      mode = /bicycling/.test(accident.distance_along_path) && 'bicycling' || 'driving'
      $tds[0].className += " #{mode}"

      $tbody.append($tr)

    $table.on 'dblclick', (e) ->
      selectText($dataDiv[0])

    $(@div).empty()
    $(@div).append($table)

class TrendChartRenderer
  constructor: (@div) ->
    @series = {}

  clearAccidents: (mode = undefined) ->
    if !mode?
      @series = {}
    else
      delete @series[mode]

  addAccidents: (mode, accidents) ->
    if accidents.length == 0
      delete @series[mode]
      return

    seriesMaker = new ChartSeriesMaker()

    for accident in accidents
      seriesMaker.add(accident.Time.split('-')[0])

    @series[mode] = seriesMaker.getSeries()

  render: () ->
    plotSeries = []
    plotSeriesOptions = []

    for mode, series of @series
      color = COLORS[mode]
      plotSeries.push(series)
      plotSeriesOptions.push({color:color})

    return unless plotSeries.length > 0

    innerId = "#{@div.id}-chartInner"

    $(@div).empty()
    $(@div).append("<div id=\"#{innerId}\"></div>")

    $.jqplot(innerId, plotSeries, {
      highlighter: { show: true, sizeAdjust: 8 },
      cursor: { show: false },
      axes: {
        xaxis: { max: 2012, tickInterval: 1 },
        yaxis: { min: 0, tickInterval: 2 },
      },
      series: plotSeriesOptions
    })

class AccidentsMarkerRenderer
  constructor: (@map) ->
    @markerArrays = {}

    iconStyles = []

    clusterUrlRoot = "#{window.location.protocol}//#{window.location.host}#{window.location.pathname.replace(/[^\/]*$/, '')}/icons"

    calculateMarkerStyleIndex = (markers, nIconStyles) ->
      # There are 9 styles:
      # 0: driving, small
      # 1: driving, medium
      # 2: driving, large
      # 3: bicycling, small
      # 4: bicycling, medium
      # 5: bicycling, large
      # 6: both, small
      # 7: both, medium
      # 8: both, large

      accidentsPath = undefined
      for marker in markers
        if !accidentsPath?
          accidentsPath = marker.accidentPath
        if accidentsPath != marker.accidentPath
          accidentsPath = 'both'
          break

      accidentsPathToSmallestIconIndex = {
        driving: 0,
        bicycling: 3,
        both: 6,
      }

      iconIndexAddition = 0
      if markers.length > 1
        iconIndexAddition += 1
      if markers.length > 3
        iconIndexAddition += 1

      text = "#{markers.length}"
      text = '1' if markers.length == 1

      index = accidentsPathToSmallestIconIndex[accidentsPath] + iconIndexAddition

      {
        text: text,
        index: index + 1
      }

    makeIconStyle = (mode, index, size) ->
      {
        width: size,
        height: size,
        textSize: size - 4
        url: "#{clusterUrlRoot}/cluster-#{mode}-#{index+1}.png",
      }

    iconStyles = [
      makeIconStyle('driving', 0, 13),
      makeIconStyle('driving', 1, 15),
      makeIconStyle('driving', 2, 17),
      makeIconStyle('bicycling', 0, 13),
      makeIconStyle('bicycling', 1, 15),
      makeIconStyle('bicycling', 2, 17),
      makeIconStyle('both', 0, 13),
      makeIconStyle('both', 1, 15),
      makeIconStyle('both', 2, 17),
    ]

    @clusterer = new MarkerClusterer(@map, [], {
      averageCenter: true,
      gridSize: 15,
      styles: iconStyles,
      calculator: calculateMarkerStyleIndex,
      minimumClusterSize: 1,
      printable: true,
      zoomOnClick: false,
    })

  clearAccidents: (mode = undefined) ->
    if !mode?
      this.clearAccidents(mode) for mode, accidents of @markerArrays
      return

    return if !@markerArrays[mode]

    @clusterer.removeMarkers(@markerArrays[mode])

    delete @markerArrays[mode]

  addAccidents: (mode, accidents) ->
    this.clearAccidents(mode)

    return if accidents.length == 0

    @markerArrays[mode] = []
    for accident in accidents
      latitude = accident.Latitude
      longitude = accident.Longitude
      latLng = new google.maps.LatLng(latitude, longitude)
      marker = new google.maps.Marker({
        position: latLng,
        flat: true,
      })
      marker.accidentUniqueKey = "#{latitude}|#{longitude}|#{accident.Time}"
      @markerArrays[mode].push(marker)

    accidentKeyToMode = {}
    for mode, markers of @markerArrays
      for marker in markers
        key = marker.accidentUniqueKey
        if accidentKeyToMode[key]? && accidentKeyToMode[key] != mode
          accidentKeyToMode[key] = 'both'
        else
          accidentKeyToMode[key] = mode

    for _, markers of @markerArrays
      for marker in markers
        key = marker.accidentUniqueKey
        marker.accidentPath = accidentKeyToMode[key]

    @clusterer.addMarkers(@markerArrays[mode], true)
    @clusterer.repaint()

  render: () ->
    # nothing. See addAccidents()

class WorstLocationsRenderer
  constructor: (@div) ->
    @topGroups = {}
    @maxLocations = 3

  clearAccidents: (mode = undefined) ->
    if !mode?
      @topGroups = {}
    else
      delete @topGroups[mode]

  addAccidents: (mode, accidents) ->
    objs = []
    results = []

    # We define a "spot" as a [x-7..x+7] stretch along the "distance_along_path" axis.

    # 1. Calculate all those stretches, in a sparse array of arrays, indexed by meter
    for accident in accidents
      distance_along_path = + ('' + accident.distance_along_path).replace(/[^\d]*/g, '')

      for d in [(distance_along_path - WORST_ACCIDENT_RADIUS) .. (distance_along_path + WORST_ACCIDENT_RADIUS)]
        continue if d < 0
        objs[d] ||= []
        objs[d].push(accident)

    # 2. Calculate results
    # Select the largest slot, and repeat as needed
    sorted = objs.slice()
    while results.length < @maxLocations
      sorted.sort((a, b) -> b.length - a.length)
      break if sorted.length == 0 or sorted[0].length == 0

      topGroup = sorted[0].slice()

      results.push(topGroup)

      # Remove these accidents from our "worst accident spot" contendors
      for accident in topGroup
        distance_along_path = + ('' + accident.distance_along_path).replace(/[^\d]*/g, '')

        for d in [(distance_along_path - WORST_ACCIDENT_RADIUS) .. (distance_along_path + WORST_ACCIDENT_RADIUS)]
          continue if d < 0 || d >= objs.length
          for a, i in objs[d]
            if a.distance_along_path == accident.distance_along_path
              # We don't need to check for equality: if one accident at this
              # distance matches, they'll all match and they'll all be removed
              objs[d].splice(i, 1)
              break

    @topGroups[mode] = results

  getTopGroups: () ->
    idToGroup = {}
    topGroupsTotal = []

    for mode, topGroups of @topGroups
      for topGroup in topGroups
        # If two groups (one per mode) contain the same accident, merge them.
        totalTopGroup = undefined

        # Search for the duplicates
        for accident in topGroup
          if idToGroup[accident.id]?
            totalTopGroup = idToGroup[accident.id]
            totalTopGroup.mode = 'both'
            break

        # If we're not merging, initialize an empty array
        if !totalTopGroup?
          totalTopGroup = { mode: mode, accidents: [] }
          topGroupsTotal.push(totalTopGroup)

        # Merge/copy into the array
        for accident in topGroup
          if !idToGroup[accident.id]?
            idToGroup[accident.id] = totalTopGroup
            totalTopGroup.accidents.push(accident)

    topGroupsTotal.sort((a, b) -> b.length - a.length)

    topGroupsTotal.slice(0, 3)

  groupToSpot: (group) ->
    sumLatitude = 0
    sumLongitude = 0
    for accident in group.accidents
      sumLatitude += accident.Latitude
      sumLongitude += accident.Longitude

    {
      Latitude: sumLatitude / group.accidents.length,
      Longitude: sumLongitude / group.accidents.length,
      mode: group.mode,
      accidents: group.accidents
    }

  getTopSpots: () ->
    (this.groupToSpot(group) for group in this.getTopGroups())

  getHeadingString: (topSpots) ->
    locations = (topSpots.length == 1 && 'location' || 'locations')
    routes = (@topGroups.bicycling? && @topGroups.driving? && 'routes' || 'route')

    "Most accident-prone #{locations} along your #{routes}"

  getTopSpotString: (topSpot) ->
    accidents = topSpot.accidents.length > 0 && 'accidents' || 'accident'
    if topSpot.mode == 'both'
      "#{topSpot.accidents.count} #{accidents} along your driving and bicycling routes"
    else
      "#{topSpot.accidents.count} #{accidents} along your #{topSpot.mode} route"

  getGeocoder: () ->
    @geocoder ||= new google.maps.Geocoder()

  renderTopSpot: (topSpot) ->
    $html = $('<li><div class="image-container"><img src="" alt="" /></div><div class="address"></div><div class="count"></div></li>')
    $html.find('.address').text("#{topSpot.Latitude},#{topSpot.Longitude}")
    $html.find('.count').text(this.getTopSpotString(topSpot))

    this.getGeocoder().geocode({
      latLng: new google.maps.LatLng(topSpot.Latitude, topSpot.Longitude)
    }, (results, status) =>
      if status == google.maps.GeocoderStatus.OK
        $html.find('.address').text(results[0].address_components[0].long_name)
    )

    # Wait for the image to be drawn so we know its height
    window.setTimeout(() ->
      $img = $html.find('img')
      url = "http://maps.googleapis.com/maps/api/streetview?sensor=false&size=#{$img.width()}x#{$img.height()}&location=#{topSpot.Latitude},#{topSpot.Longitude}"
      $img.attr('src', url)
    , 50)

    $html

  render: () ->
    $div = $(@div)

    topSpots = this.getTopSpots()
    if !topSpots.length
      $div.hide()
      return

    h2String = this.getHeadingString(topSpots)

    $div.empty()
    $h2 = $('<h2></h2>')
    $h2.text(h2String)
    $div.append($h2)

    $ul = $('<ul></ul>')

    for topSpot, i in topSpots
      $li = this.renderTopSpot(topSpot, i)
      $li.addClass("top-spot-#{i}")
      $ul.append($li)

    $div.append($ul)

class Manager
  constructor: (@map, @origin, @destination, @city, summaryDiv, chartDiv, dataDiv, worstLocationsDiv, options=undefined) ->
    this.setCity(@city)
    this.setMinYear(options? && options.minYear? && options.minYear || DEFAULT_MIN_YEAR)
    this.setMaxYear(options? && options.maxYear? && options.maxYear || DEFAULT_MAX_YEAR)

    @state = new State({
      city: @city,
      origin: @origin,
      destination: @destination,
    })
    routeFinder = new RouteFinder(@state)
    routeRenderer = new RouteRenderer(@state, @map)
    @state.onChange 'routes', (mode, route) =>
      this.queryAndUpdatePolylineRelatedLayer(mode, route)

    @summaryRenderer = new SummaryRenderer(summaryDiv)
    @summaryRenderer.setStatus('no-input')
    @summaryRenderer.render()
    @tableRenderer = new AccidentsTableRenderer(dataDiv)
    @chartRenderer = new TrendChartRenderer(chartDiv)
    @markerRenderer = new AccidentsMarkerRenderer(@map)
    @worstLocationsRenderer = new WorstLocationsRenderer(worstLocationsDiv)

  setCity: (@city) ->
    zoomData = CITIES[@city]
    latlng = new google.maps.LatLng(zoomData.latitude, zoomData.longitude)
    zoom = zoomData.zoom
    @map.setCenter(latlng)
    @map.setZoom(zoom)

  getCityYearRange: () ->
    cityData = CITIES[@city]
    [ cityData.minYear, cityData.maxYear ]

  getYearRange: () ->
    [ + @minDate.split(/-/)[0], + @maxDate.split(/-/)[0] ]

  setMinYear: (year) ->
    cityData = CITIES[@city]
    year = cityData.minYear if year < cityData.minYear
    @minDate = "#{year}-01-01"

  setMaxYear: (year) ->
    cityData = CITIES[@city]
    year = cityData.maxYear if year > cityData.maxYear
    @maxDate = "#{year}-12-31"

  getCityBounds: () ->
    CITIES[@city].bounds

  setOrigin: (@origin) ->
    if @origin
      if !@originMarker?
        @originMarker = new google.maps.Marker({
          position: @origin,
          map: @map
        })
      else
        @originMarker.setPosition(@origin)
    else
      if @originMarker?
        @originMarker.setMap(null)
        delete @originMarker
    @state.setOrigin(@origin)

  setDestination: (@destination) ->
    if @destination
      if !@destinationMarker?
        @destinationMarker = new google.maps.Marker({
          position: @destination,
          map: @map
        })
      else
        @destinationMarker.setPosition(@destination)
    else
      if @destinationMarker?
        @destinationMarker.setMap(null)
        delete @destinationMarker
    @state.setDestination(@destination)

  queryAndUpdatePolylineRelatedLayer: (mode, googleDirectionsResult) ->
    @lastRequests ||= {}

    if @lastRequests[mode]?
      @lastRequests[mode].abort()
      delete @lastRequests[mode]

    this.clearOldData(mode) # just in case?
    return unless googleDirectionsResult?

    encoded_polyline = googleDirectionsResult.routes[0].overview_polyline.points
    postData = { encoded_polyline: encoded_polyline }

    url = URL.replace(/%\{city\}/, @city)

    @lastRequests[mode] = $.ajax({ url: url, type: 'POST', data: postData, dataType: 'json', success: (data) =>
      delete @lastRequests[mode]

      this.clearOldData(mode) # just in case?
      this.handleNewData(mode, data)
    })

  clearOldData: (mode = undefined) ->
    @summaryRenderer.clearAccidents(mode)
    @tableRenderer.clearAccidents(mode)
    @chartRenderer.clearAccidents(mode)
    @markerRenderer.clearAccidents(mode)
    @worstLocationsRenderer.clearAccidents(mode)

  handleNewData: (mode, data) ->
    @summaryRenderer.addAccidents(mode, data)
    @tableRenderer.addAccidents(mode, data)
    @chartRenderer.addAccidents(mode, data)
    @markerRenderer.addAccidents(mode, data)
    @worstLocationsRenderer.addAccidents(mode, data)

    @summaryRenderer.render()
    @tableRenderer.render()
    @chartRenderer.render()
    @markerRenderer.render()
    @worstLocationsRenderer.render()

window.Manager = Manager

make_expander = (div) ->
  $h2 = $(div).children('h2')

  $h2.on 'click', (e) ->
    $inner = $(div).children('div')
    if $inner.is(':visible')
      $inner.hide()
    else
      $inner.show()

$.fn.expander = () ->
  $.each(this, () -> make_expander(this))

class AddressSearchForm
  constructor: (form, @originOrDestination, @manager) ->
    $form = $(form)
    @$a = $form.find('a')
    @aText = @$a.text()
    @$input = $form.find('input[type=text]')
    @$status = $form.find('div.status')
    @$error = $form.find('div.error')
    @lastAddressTyped = @$input.val()
    @mapListener = undefined

    $form.on 'submit', (e) =>
      e.stopPropagation()
      e.preventDefault()
      this.onAddressTyped()

    @$a.on 'click', (e) =>
      $a = $(e.target)
      e.stopPropagation()
      e.preventDefault()
      if @mapListener?
        google.maps.event.removeListener(@mapListener)
        @mapListener = undefined
        this.setClickingOnMap(false)
      else
        @mapListener = google.maps.event.addListenerOnce(@manager.map, 'click', (e) =>
          @mapListener = undefined
          this.setClickingOnMap(false)
          this.onAddressClicked(e.latLng)
        )
        this.setClickingOnMap(true)

  setClickingOnMap: (clickingOnMap) ->
    if clickingOnMap
      @$a.text('Click a point on the map to choose it')
      @$a.addClass('clicking')
    else
      @$a.text(@aText)
      @$a.removeClass('clicking')

  getGeocoder: () ->
    @geocoder ||= new google.maps.Geocoder()

  onAddressTyped: () ->
    addressTyped = @$input.val()
    return if addressTyped == @lastAddressTyped

    this.setError(undefined)

    if $.trim(addressTyped || '')
      this.setStatus('Looking up address')
      @lastAddressTyped = addressTyped
      this.getGeocoder().geocode({
        'address': addressTyped,
        'bounds': @manager.getCityBounds(),
      }, (results, status) =>
        this.onAddressGeocoded(results, status)
      )
    else
      this.setStatus(undefined)
      this.setLatLng(undefined)

  setStatus: (status) ->
    @$status.text(status || '')
    if status?
      @$status.show()
    else
      @$status.hide()

  setError: (error) ->
    @$error.text(error || '')
    if error?
      @$error.show()
    else
      @$error.hide()

  onAddressClicked: (latlng) ->
    this.setLatLng(latlng)
    this.setError(undefined)

    if latlng?
      this.setStatus('Finding address')
      @$input.val('…')
      this.getGeocoder().geocode({
        latLng: latlng
      }, (results, status) =>
        this.onLatLngGeocoded(results, status)
      )
    else
      @$input.val('')
      this.setStatus(undefined)

  setLatLng: (latlng) ->
    if @originOrDestination == 'origin'
      @manager.setOrigin(latlng)
    else
      @manager.setDestination(latlng)

    if latlng?
      bounds = @manager.map.getBounds()
      if !bounds.contains(latlng)
        bounds.extend(latlng)
        @manager.map.fitBounds(bounds)

  onAddressGeocoded: (results, status) ->
    this.setStatus(undefined)
    cityBounds = @manager.getCityBounds()
    if status == google.maps.GeocoderStatus.ZERO_RESULTS or (
        status == google.maps.GeocoderStatus.OK && !cityBounds.contains(results[0].geometry.location))
      this.setError('Address not found')
      this.setLatLng(null)
    else if status == google.maps.GeocoderStatus.OK
      this.setLatLng(results[0].geometry.location)
    else
      this.setError('Failed to look up address')
      this.setLatLng(null)

  onLatLngGeocoded: (results, status) ->
    this.setStatus(undefined)
    if status == google.maps.GeocoderStatus.OK
      @$input.val(results[0].formatted_address)
    else
      @$input.val('(point on map)')

$.fn.address_search_form = (originOrDestination, manager) ->
  $.each(this, () -> new AddressSearchForm(this, originOrDestination, manager))
