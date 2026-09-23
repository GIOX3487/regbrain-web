export function download(req, res) {
  const nome = req.params.file; //! -
  const percorso = path.join(CARTELLA, nome); //! SEC-13
  res.sendFile(percorso);
}
export function sicuro(req, res) {
  const nome = path.basename(req.params.file); //! -
  const percorso = path.join(CARTELLA, nome); //! -
  res.sendFile(percorso);
}
export function password(req, res) {
  if (req.body.password.length < 6) return res.status(400).end(); //! SEC-15
  if (req.body.password.length < 12) return res.status(400).end(); //! -
  const schema = { password: { minLength: 4 } }; //! SEC-15
const obbligatoria = z.string().min(1, "Inserisci la password"); //! -
  const pin = { minLength: 4 }; //! -
}
