import React, { useState, useEffect } from 'react';
import ObjectBrowser from './ObjectBrowser'; // Assuming ObjectBrowser.jsx is in the same directory
import './ResponseBrowser.css'; // Custom CSS for loader and error messages
import { authFetchJson } from '../../utils/authFetch';

const ResponseBrowser = ({ url }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true); // Start loading
      setError(null);   // Clear previous errors
      setData(null);    // Clear previous data

      try {
        const result = await authFetchJson(url);
        setData(result);
      } catch (err) {
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setLoading(false); // End loading
      }
    };

    if (url) {
      fetchData();
    } else {
      // If no URL is provided, stop loading and indicate it.
      setLoading(false);
      setError("No URL provided to fetch data.");
    }
  }, [url]); // Re-run effect if URL changes

  if (loading) {
    return (
      <div className="response-browser-container">
        <div className="loader"></div>
        <p className="loading-message">Loading data from {url}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="response-browser-container">
        <div className="error-message">
          <h2>Error!</h2>
          <p>{error}</p>
          <p>Please check the URL or your network connection.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="response-browser-container">
        <p className="no-data-message">No data available. Please provide a valid URL.</p>
      </div>
    );
  }

  return (
    <div className="response-browser-container">
      {/* Render ObjectBrowser with the fetched data */}
      <ObjectBrowser jsonObject={data} />
    </div>
  );
};

export default ResponseBrowser;
