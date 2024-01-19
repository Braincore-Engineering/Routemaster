const mapApp = () => {
  const accessToken = "pk.eyJ1IjoidHJhdmVucyIsImEiOiJjbDB6YngxZXAwam92M2Jtb3g3bWlzZnUxIn0.BKOufMZPrYPBuVek7uR7pQ";
  return {
    newDestination: "",
    destinations: [],
    suggestions: [],
    map: null, // Store the map instance
    markers: [], // Store markers
    routeControl: null, // for storing the routing control

    initMap() {
      // Set initial view to Jakarta
      this.map = L.map("map").setView([-6.2088, 106.8456], 13);

      L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}", {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: "mapbox/streets-v11",
        tileSize: 512,
        zoomOffset: -1,
        accessToken: accessToken,
      }).addTo(this.map);
    },

    addDestination() {
      if (this.newDestination) {
        this.destinations.push(this.newDestination);
        this.placeMarker(this.newDestination);
        this.newDestination = "";
        this.suggestions = [];
        if (this.destinations.length > 1) {
          this.drawRoute();
        }
      }
    },

    async drawRoute() {
      // Remove the existing route control if it exists
      if (this.routeControl && this.routeControl.remove) {
        this.routeControl.remove();
        this.routeControl = null;
      }

      const resolvedWaypoints = await this.resolveWaypoints();

      if (resolvedWaypoints.length < 2) {
        console.error("Insufficient valid waypoints for routing.");
        return;
      }

      let customRouter = (waypoints, callback) => {
        let url = "https://api.mapbox.com/directions/v5/mapbox/driving/";
        url += waypoints.map((wp) => `${wp.latLng.lng},${wp.latLng.lat}`).join(";");
        url += "?access_token=" + accessToken;
        url += "&overview=full&geometries=geojson";

        axios
          .get(url)
          .then((response) => {
            let coordinates = response.data.routes[0].geometry.coordinates;
            let latLngs = coordinates.map((coord) => L.latLng(coord[1], coord[0]));
            let polyline = L.polyline(latLngs, { color: "blue" }).addTo(this.map);
            this.map.fitBounds(polyline.getBounds());
            callback(null, latLngs);
          })
          .catch((error) => {
            console.error("Routing Error:", error);
            callback(error, null);
          });
      };

      // Initialize a new route control
      this.routeControl = L.Routing.control({
        waypoints: resolvedWaypoints,
        routeWhileDragging: false,
        router: { route: customRouter },
      }).addTo(this.map);
    },

    async resolveWaypoints() {
      const geocodedWaypoints = await Promise.all(
        this.destinations.map(async (destination) => {
          return await this.geocodeDestination(destination);
        })
      );

      // Filter out any null waypoints
      const validWaypoints = geocodedWaypoints.filter((wp) => wp !== null);

      return validWaypoints;
    },

    // New method to geocode a destination
    async geocodeDestination(destination) {
      try {
        const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json?access_token=${accessToken}`);
        const coords = response.data.features[0].center;
        console.log(`Geocoded ${destination}:`, coords); // Log the coordinates
        return L.latLng(coords[1], coords[0]); // Latitude, then Longitude
      } catch (error) {
        console.error("Error geocoding destination:", error);
        return null;
      }
    },

    async placeMarker(destination) {
      try {
        const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json?access_token=${accessToken}`);
        const coords = response.data.features[0].center;
        const marker = L.marker([coords[1], coords[0]]).addTo(this.map);
        marker.bindPopup(destination).openPopup();
        this.markers.push(marker);

        // Adjust map view to show all markers
        if (this.markers.length > 1) {
          const group = new L.featureGroup(this.markers);
          this.map.fitBounds(group.getBounds());
        }
      } catch (error) {
        console.error("Error placing marker:", error);
      }
    },

    async fetchAutocomplete() {
      if (this.newDestination.length >= 3) {
        try {
          const response = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(this.newDestination)}.json?access_token=pk.eyJ1IjoidHJhdmVucyIsImEiOiJjbDB6YngxZXAwam92M2Jtb3g3bWlzZnUxIn0.BKOufMZPrYPBuVek7uR7pQ&limit=5`
          );
          this.suggestions = response.data.features.map((item) => item.place_name);
        } catch (error) {
          console.error("Error fetching autocomplete suggestions:", error);
        }
      } else {
        this.suggestions = [];
      }
    },

    selectSuggestion(suggestion) {
      this.newDestination = suggestion;
      this.suggestions = [];
    },

    removeDestination(index) {
      if (index >= 0 && index < this.destinations.length) {
        this.destinations.splice(index, 1);
        this.removeMarker(index); // Remove the corresponding marker from the map
        this.drawRoute(); // Redraw the route with the updated destinations
      }
    },

    removeMarker(index) {
      if (index >= 0 && index < this.markers.length) {
        this.map.removeLayer(this.markers[index]);
        this.markers.splice(index, 1);
      }
    },
  };
};
