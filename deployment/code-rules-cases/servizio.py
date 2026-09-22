import hashlib, requests, logging

DEBUG = True  #! SEC-09
TIMEOUT = 30  #! -

pwd_hash = hashlib.md5(password.encode()).hexdigest()  #! SEC-02
file_hash = hashlib.sha256(open(path, "rb").read()).hexdigest()  #! -

requests.get(url, verify=False)  #! SEC-04
requests.get(url, verify=ca_bundle)  #! -

logging.info("richiesta completata in %s ms", ms)  #! -
logging.debug("telefono cliente: %s", cliente.telefono)  #! PRIV-02
print("indirizzo del server avviato")  #! -

class Paziente(models.Model):
    diagnosi = models.CharField(max_length=200)  #! PRIV-05
    health_status = models.CharField(max_length=20)  #! PRIV-05
    nome = models.CharField(max_length=80)  #! -
    health_check_url = models.URLField()  #! -

query = "SELECT * FROM ordini WHERE cliente = '%s'" % cliente_id  #! SEC-05
cursor.execute("SELECT * FROM ordini WHERE cliente = %s", (cliente_id,))  #! -

import openai  #! AI-01
os.system("rm -rf " + cartella)  #! SEC-06
subprocess.run(["rm", "-rf", cartella])  #! -
