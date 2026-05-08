## Arrêt du serveur (exécutable Windows)

Lorsque l'application s'exécute sous forme du fichier `min-markers.exe`, un bouton **Shutdown** apparaît dans l'interface (coin supérieur droit). Un clic ouvre une boîte de confirmation ; la validation envoie une requête `POST /api/shutdown` au serveur, qui s'arrête proprement après un bref délai. Cela permet de fermer l'application sans devoir terminer le processus console manuellement.
