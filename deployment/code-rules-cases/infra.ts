const bucket = { region: "us-east-1", name: "clienti" }; //! PRIV-07
const bucketEu = { region: "eu-central-1", name: "clienti" }; //! -
const cdn = { regions: ["fra1", "cdg1"] }; //! -

export function handler(req: Request, res: Response) {
  const ip = req.headers["x-forwarded-for"]; //! PRIV-08
  const clientIp = req.ip; //! PRIV-08
  const lingua = req.headers["accept-language"]; //! -
  res.setHeader("Access-Control-Allow-Origin", "*"); //! SEC-08
  res.setHeader("Access-Control-Allow-Origin", "https://app.regbrain.eu"); //! -
  logger.info("richiesta da", clientIp); //! PRIV-08
  const url = `http://${host}/api/v1`; //! SEC-03
  const codice = new Function("return 1"); //! SEC-06
  const dati = JSON.parse(payload); //! -
  localStorage.setItem("refresh_token", t); //! PRIV-06
  localStorage.setItem("auth_redirect", percorso); //! -
  document.cookie = "consenso=1; path=/"; //! -
}

// Casi nati da errori osservati in produzione.
const risposta = requests.post("http://auth.interno.it/login", { verify: false }); //! SEC-03
const link = [
  "http://shop.example.org/prodotto", //! -
  "http://blog.example.org/articolo", //! -
];
logger.info("bonifico ricevuto", cliente.iban); //! PRIV-02
