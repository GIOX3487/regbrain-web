const utente = { email: "prova@example.com", password: "Passw0rdDiProva" }; //! SEC-01
test("login riuscito", async () => {
  const r = await api.post("/login", utente); //! -
  expect(r.status).toBe(200); //! -
});
