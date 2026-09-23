class Utente(models.Model):
    ethnicity = models.CharField(max_length=40)  #! PRIV-05
    nome = models.CharField(max_length=40)  #! -

TESTO_AIUTO = "Le categorie particolari comprendono la salute e i dati biometrici"  #! -
print("Salvato documento", doc.id)  #! -
logging.error("errore imprevisto", exc_info=True)  #! -
class Prenotazione(models.Model):
    diagnosi_precedente = models.TextField(blank=True)  #! PRIV-05
