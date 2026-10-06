const express = require("express");
const app = express();
const auth = require("./auth");
app.get("/health", (req, res) => res.send("ok")); //! -
app.post("/api/login", (req, res) => { /* rilascia il token */ }); //! -
app.get("/api/profile", auth, (req, res) => res.json(req.user)); //! -
app.post("/api/orders", (req, res) => { //! SEC-16
  db.orders.insert(req.body);
  res.status(201).end();
});
app.delete("/api/orders/:id", (req, res) => { //! SEC-16
  db.orders.remove(req.params.id);
  res.end();
});
app.get("/api/orders/:id", (req, res) => { //! -
  if (!req.user) return res.sendStatus(401);
  res.json(db.orders.get(req.params.id));
});
app.get("/api/catalog", (req, res) => res.json(db.catalog.all())); //! SEC-16
