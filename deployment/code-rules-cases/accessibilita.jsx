export function Modulo() {
  return (
    <form>
      <label htmlFor="email">Email</label> {/*! - */}
      <input id="email" type="email" /> {/*! - */}
      <input type="text" name="citta" /> {/*! ACC-03 */}
      <input type="search" aria-label="Cerca" /> {/*! - */}
      <label>Telefono <input type="tel" name="tel" /></label> {/*! - */}
      <select name="paese"> {/*! ACC-03 */}
        <option>Italia</option>
      </select>
      <textarea {/*! ACC-03 */}
        name="note"
        rows={3}
      />
      <input type="submit" value="Invia" /> {/*! - */}
      <button type="button" onClick={chiudi}><XIcon /></button> {/*! ACC-04 */}
      <button type="button" aria-label="Chiudi" onClick={chiudi}><XIcon /></button> {/*! - */}
      <button type="submit">Invia</button> {/*! - */}
      <button type="button">{t("salva")}</button> {/*! - */}
      <a href="/aiuto"><img src="/aiuto.png" alt="" /></a> {/*! ACC-04 */}
      <a href="/aiuto"><img src="/aiuto.png" alt="Aiuto" /></a> {/*! - */}
      <a onClick={apri}>Apri</a> {/*! ACC-04 */}
      <div onClick={seleziona}>Riga</div> {/*! ACC-08 */}
      <div role="button" tabIndex={0} onClick={seleziona} onKeyDown={tasto}>Riga</div> {/*! - */}
      <span tabIndex="3">Salta</span> {/*! ACC-08 */}
      <video src="/intro.mp4" autoPlay muted loop /> {/*! ACC-07 */}
      <video src="/intro.mp4" autoPlay controls /> {/*! - */}
      <div className="p-2 focus:outline-none">Casella</div> {/*! ACC-05 */}
      <div className="p-2 focus:outline-none focus:ring-2">Casella</div> {/*! - */}
    </form>
  );
}
