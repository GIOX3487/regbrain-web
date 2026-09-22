import React from "react";
import posthog from "posthog-js"; //! PRIV-01

export function App() {
  posthog.capture("pagina vista"); //! PRIV-01
  window.dataLayer = window.dataLayer || [];
  gtag("js", new Date()); //! PRIV-01
  analytics.track("bottone premuto"); //! -

  localStorage.setItem("access_token", session.token); //! PRIV-06
  localStorage.setItem("tema", "scuro"); //! -
  sessionStorage.setItem("jwt_utente", jwt); //! PRIV-06

  navigator.geolocation.getCurrentPosition(mostraMappa); //! PRIV-03
  const canvasData = canvas.toDataURL(); //! -

  const risposta = fetch("https://api.openai.com/v1/chat/completions"); //! AI-01
  const immagine = openai.images.generate({ prompt: p }); //! AI-02

  return (
    <div>
      <img src="/logo.png" /> {/*! ACC-01 */}
      <img src="/foto.png" alt="Foto della sede" /> {/*! - */}
      <img {...rest} alt={etichetta} /> {/*! - */}
      <div dangerouslySetInnerHTML={{ __html: contenuto }} /> {/*! SEC-06 */}
    </div>
  );
}
