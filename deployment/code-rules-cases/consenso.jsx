export function Registrazione() {
  return (
    <form>
      <input type="checkbox" name="newsletter" defaultChecked /> Iscrivimi alla newsletter {/*! PRIV-09, ACC-03 */}
      <input type="checkbox" name="privacy" checked={accepted} onChange={toggle} /> Ho letto l'informativa {/*! ACC-03 */}
      <input type="checkbox" name="marketing" checked /> Accetto comunicazioni commerciali {/*! PRIV-09, ACC-03 */}
      <input type="checkbox" name="ricordami" defaultChecked /> Ricordami {/*! ACC-03 */}
      <input type="radio" name="piano" checked /> Piano base {/*! ACC-03 */}
      <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" /> {/*! PRIV-10 */}
      <iframe src="https://www.youtube.com/embed/abc123" /> {/*! PRIV-10 */}
      <iframe src="https://www.youtube-nocookie.com/embed/abc123" /> {/*! - */}
      <script src="https://www.google.com/recaptcha/api.js" /> {/*! PRIV-10 */}
    </form>
  );
}
const stream = await navigator.mediaDevices.getUserMedia({ video: true }); //! PRIV-11
const styled = require("@emotion/styled"); //! -
const contacts = await navigator.contacts.select(["name", "tel"]); //! PRIV-11
