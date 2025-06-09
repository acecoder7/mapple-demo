require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(bodyParser.raw({ type: 'application/json' }));

// // ─────────────────────────────────────────────────────────────────────────────
// // 0) Ensure env vars are set
// // ─────────────────────────────────────────────────────────────────────────────
// if (!process.env.MYINDIA_CLIENT_ID || !process.env.MYINDIA_CLIENT_SECRET) {
//   console.error(
//     "❌ Missing MapMyIndia credentials in .env. Please set MYINDIA_CLIENT_ID and MYINDIA_CLIENT_SECRET."
//   );
//   process.exit(1);
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 1) In-Memory Token Cache
// // ─────────────────────────────────────────────────────────────────────────────
// let cachedToken = null;
// let tokenExpiryTimestamp = 0;

// /**
//  * fetchAccessToken()
//  *  - If we have a valid cached token, returns it.
//  *  - Otherwise, POSTs x-www-form-urlencoded to get a new token.
//  */
// async function fetchAccessToken() {
//   const now = Date.now();
//   if (cachedToken && now < tokenExpiryTimestamp) {
//     return cachedToken;
//   }

//   const tokenURL = "https://outpost.mapmyindia.com/api/security/oauth/token";
//   const params = new URLSearchParams({
//     grant_type: "client_credentials",
//     client_id: process.env.MYINDIA_CLIENT_ID,
//     client_secret: process.env.MYINDIA_CLIENT_SECRET,
//   });

//   try {
//     const resp = await axios.post(tokenURL, params.toString(), {
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//     });

//     const { access_token, expires_in } = resp.data;
//     if (!access_token) {
//       throw new Error("No access_token returned by MapMyIndia");
//     }

//     cachedToken = access_token;
//     // Subtract 30 seconds so we refresh slightly before actual expiry
//     tokenExpiryTimestamp = now + (expires_in - 30) * 1000;

//     console.log("✅ Obtained new MapMyIndia token. Expires in", expires_in, "seconds.");
//     return cachedToken;
//   } catch (err) {
//     console.error("❌ Error fetching MapMyIndia access token:", err.response?.data || err.message);
//     throw new Error("Failed to obtain MapMyIndia access token");
//   }
// }

// ─────────────────────────────────────────────────────────────────────────────
// 2) General error handler
// ─────────────────────────────────────────────────────────────────────────────
function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
}

// // ─────────────────────────────────────────────────────────────────────────────
// // 3) Auto-Suggest Route
// //    GET /api/map/auto-suggest?query=<TEXT>
// // ─────────────────────────────────────────────────────────────────────────────
// app.get("/api/map/auto-suggest", async (req, res, next) => {
//   try {
//     const { query } = req.query;
//     if (!query || query.trim().length < 1) {
//       return res.status(400).json({ error: "Missing or empty `query` parameter." });
//     }

//     const token = await fetchAccessToken();
//     // MapMyIndia Places Search / Auto-Suggest URL
//     const searchURL =
//       "https://atlas.mapmyindia.com/api/places/search/json?" +
//       `query=${encodeURIComponent(query)}&region=India&tooltip=true`;

//     const apiRes = await axios.get(searchURL, {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     return res.json({ results: apiRes.data.results || [] });
//   } catch (err) {
//     next(err);
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // 4) Geocode Route
// //    GET /api/map/geocode?address=<FORMATTED_ADDRESS>
// // ─────────────────────────────────────────────────────────────────────────────
// app.get("/api/map/geocode", async (req, res, next) => {
//   try {
//     const { address } = req.query;
//     if (!address || address.trim().length < 1) {
//       return res.status(400).json({ error: "Missing or empty `address` parameter." });
//     }

//     const token = await fetchAccessToken();
//     const geocodeURL =
//       "https://atlas.mapmyindia.com/api/geocode/geo/json?" +
//       `address=${encodeURIComponent(address)}`;

//     const geoRes = await axios.get(geocodeURL, {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     const first = Array.isArray(geoRes.data.results) ? geoRes.data.results[0] : null;
//     if (!first) {
//       return res.status(404).json({ error: "No geocode result found." });
//     }

//     const responsePayload = {
//       latitude: first.pos.lat,
//       longitude: first.pos.lng,
//       formatted_address: first.formatted_address,
//       place_id: first.place_id,
//     };
//     return res.json(responsePayload);
//   } catch (err) {
//     next(err);
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // 5) Reverse Geocode (optional; for “pick on map” later)
// //    GET /api/map/reverse-geocode?lat=<LAT>&lng=<LNG>
// // ─────────────────────────────────────────────────────────────────────────────
// app.get("/api/map/reverse-geocode", async (req, res, next) => {
//   try {
//     const { lat, lng } = req.query;
//     if (!lat || !lng) {
//       return res.status(400).json({ error: "Missing `lat` or `lng` parameter." });
//     }

//     const token = await fetchAccessToken();
//     const revURL = "https://atlas.mapmyindia.com/api/geo/reverse?" + `lat=${lat}&lng=${lng}`;
//     const revRes = await axios.get(revURL, {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     const first = Array.isArray(revRes.data.results) ? revRes.data.results[0] : null;
//     if (!first) {
//       return res.status(404).json({ error: "No reverse geocode result found." });
//     }
//     return res.json(first);
//   } catch (err) {
//     next(err);
//   }
// });


/**
 * Handler for "orders/create" webhook
 */
function handleOrderCreated(req, res) {
  console.log('🔔 [orders/create] Order Created event received:');
  // console.log(JSON.stringify(parseBody(req), null, 2));
  res.sendStatus(200);
}

/**
 * Handler for "orders/fulfilled" webhook
 */
function handleOrderFulfilled(req, res) {
  console.log('✅ [orders/fulfilled] Order Fulfilled event received:');
  // console.log(JSON.stringify(parseBody(req), null, 2));
  res.sendStatus(200);
}

/**
 * Handler for "fulfillments/create" webhook
 */
function handleFulfillmentCreated(req, res) {
  console.log('📦 [fulfillments/create] Fulfillment Created event received:');
  // console.log(JSON.stringify(parseBody(req), null, 2));
  res.sendStatus(200);
}

/**
 * Handler for "fulfillment_order/line_items_prepared_for_local_delivery" webhook
 */
function handleLocalDeliveryPrep(req, res) {
  console.log('🚚 [fulfillment_order/line_items_prepared_for_local_delivery] Local Delivery Prep event received:');
  // console.log(JSON.stringify(parseBody(req), null, 2));
  res.sendStatus(200);
}

/**
 * Parse raw body into JSON safely
 */
function parseBody(req) {
  try {
    return JSON.parse(req.body.toString('utf8'));
  } catch (error) {
    console.error('Failed to parse JSON body:', error);
    return {};
  }
}

// Routes
app.post('/webhooks/orders-create', handleOrderCreated);
app.post('/webhooks/orders-fulfilled', handleOrderFulfilled);
app.post('/webhooks/fulfillments-create', handleFulfillmentCreated);
app.post(
  '/webhooks/fulfillment_order/line_items_prepared_for_local_delivery',
  handleLocalDeliveryPrep
);

// ─────────────────────────────────────────────────────────────────────────────
// Root Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("MapMyIndia backend is running.");
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handler
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Start the Server
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
