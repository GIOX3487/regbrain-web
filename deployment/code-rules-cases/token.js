const jwt = require("jsonwebtoken");
const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }); //! -
const claims = jwt.verify(token, secret, { algorithms: ["none"] }); //! SEC-11
const lax = jwt.verify(token, secret, { ignoreExpiration: true }); //! SEC-11
const user = jwt.decode(token); //! -
const role = jwt.decode(token).role; //! SEC-11
const isAdmin = jwt.decode(req.headers.authorization).isAdmin; //! SEC-11
const header = jwt.decode(token, { complete: true }).header; //! -
const empty = jwt.verify(token, ""); //! SEC-11
const nodeSerialize = require("node-serialize").unserialize(req.body.data); //! SEC-12
const fine = JSON.parse(req.body.data); //! -
const stream = fs.createReadStream(path.join(UPLOAD_DIR, req.params.name)); //! SEC-13
const safe = fs.createReadStream(path.join(UPLOAD_DIR, path.basename(req.params.name))); //! -
res.sendFile(req.query.file); //! SEC-13
res.sendFile(path.resolve("public", "index.html")); //! -
const cfg = fs.readFileSync("./config.json", "utf8"); //! -
