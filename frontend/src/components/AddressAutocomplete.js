import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../App.css"; // for shared styles (optional)

export default function AddressAutocomplete() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [coords, setCoords] = useState(null);

  // To cancel in-flight axios requests if user types quickly
  const cancelTokenRef = useRef(null);

  // Fetch suggestions whenever `query` ≥ 3 chars
  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    // Cancel previous request if still pending
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel();
    }
    cancelTokenRef.current = axios.CancelToken.source();

    const fetchSuggestions = async () => {
      try {
        const resp = await axios.get(
          `/api/map/auto-suggest?query=${encodeURIComponent(query)}`,
          {
            cancelToken: cancelTokenRef.current.token,
          }
        );
        // We expect backend to return { results: [ { place_id, place_address, place_location: { latitude, longitude } }, … ] }
        const data = resp.data.results || [];
        setSuggestions(data);
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error("Error fetching suggestions:", err);
        }
      }
    };

    fetchSuggestions();
  }, [query]);

  // When a user clicks a suggestion:
  const handleSelect = async (item) => {
    const addressText = item.place_address;
    setSelected(item);       // store the full object from autosuggest
    setQuery(addressText);   // put the chosen address into the input
    setSuggestions([]);      // clear dropdown

    // Geocode it to get exact lat/long + formatted_address
    try {
      const geoResp = await axios.get(
        `/api/map/geocode?address=${encodeURIComponent(addressText)}`
      );
      // We expect { latitude, longitude, formatted_address, place_id }
      setCoords(geoResp.data);
    } catch (err) {
      console.error("Error geocoding selected address:", err);
      setCoords(null);
    }
  };

  return (
    <div className="input-box">
      <input
        type="text"
        placeholder="Start typing your address..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setCoords(null);
        }}
      />
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((place) => (
            <li key={place.place_id} onClick={() => handleSelect(place)}>
              {place.place_address}
            </li>
          ))}
        </ul>
      )}

      {selected && coords && (
        <div className="selected-info">
          <h3>Selected Address</h3>
          <p>
            <strong>Address:</strong>{" "}
            {coords.formatted_address || selected.place_address}
          </p>
          <p>
            <strong>Latitude:</strong> {coords.latitude}
          </p>
          <p>
            <strong>Longitude:</strong> {coords.longitude}
          </p>
          <p>
            <strong>Place ID:</strong> {coords.place_id}
          </p>
        </div>
      )}
    </div>
  );
}
