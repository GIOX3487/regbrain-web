const express = require("express");
const crypto = require("crypto");
const app = express();

const STRIPE_KEY = "sk_live_51HxxAbCdEfGhIjKlMnOpQrStUvWx"; //! SEC-01
const dbPassword = "Sup3rS3gret2026"; //! SEC-01
const AWS_ID = "AKIAIOSFODNN7EXAMPLE"; //! SEC-01
const apiKey = process.env.OPENAI_API_KEY; //! -
const passwordPlaceholder = "changeme1234"; //! -
const passwordLabel = "Inserisci la password"; //! -
const tokenHeaderName = "x-auth-token"; //! -

app.get("/users", (req, res) => { //! SEC-16
  db.query("SELECT * FROM users WHERE id = " + req.query.id); //! SEC-05
});
app.get("/safe", (req, res) => { //! SEC-16
  db.query("SELECT * FROM users WHERE id = $1", [req.query.id]); //! -
});
app.get("/tpl", (req, res) => { //! SEC-16
  db.query(`SELECT name FROM clienti WHERE mail = '${req.query.m}'`); //! SEC-05
});

const etag = crypto.createHash("md5").update(fileBuffer).digest("hex"); //! -
const pwdHash = crypto.createHash("md5").update(userPassword).digest("hex"); //! SEC-02
const digest = crypto.createHash("sha256").update(body).digest("hex"); //! -

fetch("http://api.partner.it/v1/login"); //! SEC-03
fetch("https://api.partner.it/v1/login"); //! -
fetch("http://localhost:8080/health"); //! -
const ns = "http://schemas.xmlsoap.org/soap/envelope/"; //! -

const agent = new https.Agent({ rejectUnauthorized: false }); //! SEC-04
const agentOk = new https.Agent({ rejectUnauthorized: true }); //! -

console.log("utente autenticato", user.email); //! PRIV-02
console.log("password errata per l'utente", user.password); //! PRIV-02
console.log("email inviata correttamente"); //! -
logger.info("Processo di importazione terminato"); //! -
console.log("richieste servite:", count); //! -

res.cookie("session", token); //! SEC-07
res.cookie("session", token, { httpOnly: true, secure: true, sameSite: "lax" }); //! -
const raw = document.cookie; //! -

app.use(cors({ origin: "*", credentials: true })); //! SEC-08
app.use(cors({ origin: allowedOrigins })); //! -

const otp = Math.floor(Math.random() * 1000000).toString(); // codice OTP //! SEC-10
const delay = Math.random() * 300; //! -
const nonce = crypto.randomBytes(16).toString("hex"); //! -

module.exports = app;
element.innerHTML += utente.bio; //! SEC-06
el.insertAdjacentHTML("beforeend", commento); //! SEC-06
const sicuro = this.sanitizer.bypassSecurityTrustHtml(testo); //! SEC-06
const percorsoFile = path.join(FTP, params.file); //! SEC-13
const digest = crypto.createHash("md5").update(content).digest("hex"); //! -
const logo = "http://cdn.esempio.org/logo.png"; //! -
const { pazienteId, note, diagnosi_precedente } = req.body; //! PRIV-05
