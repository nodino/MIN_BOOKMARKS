# MIN MARKERS - Manuel Utilisateur

Version : **1.0.12**

_Consultez la **Documentation Technique** et les fichiers template: `DOCS/TECHNICAL_DOCUMENTATION_FR.md`._

## Présentation
**MIN MARKERS** est une application d’enregistrement de timecode et de création de marqueurs fonctionnant en mode **Free Run** autonome. Elle permet de créer, gérer et colorer rapidement des marqueurs d’événement et prend en charge l’exportation vers Adobe Premiere Pro.

## Modes

### Mode Free Run
Mode autonome où vous contrôlez manuellement le timecode sans matériel externe.
- **Heure de départ** : saisissez le timecode souhaité (ex. `10:00:00:00`) dans le champ prévu.
- **Fréquence d’images** : choisissez la fréquence de votre projet (23.98, 24, 25, 29.97, 30, 50, 59.94, 60) dans le menu déroulant pour garantir un calcul précis du timecode.
- **Démarrer / Pause** : cliquez sur le bouton **Start** pour lancer le timecode, puis pausez/reprenez à votre convenance.
- **Réinitialiser** : cliquez sur **Reset** pour remettre le timecode à la valeur de départ.

## Création & Gestion des Marqueurs

### 1. Saisie Directe (Manuelle)
- Sélectionnez le champ de texte principal.
- Tapez votre commentaire et appuyez sur **Enter**.
- Avant l’enregistrement, choisissez une couleur (Accent, Bleu, Violet) pour visualiser différents types d’événements (erreurs, moments forts, démarrages, etc.).

### 2. Grille d’Actions Instantanées
Touchez rapidement les boutons pré‑configurés de la zone **Instant Actions** pour consigner un marqueur en un clic.

### 3. Modification des Marqueurs
Vous pouvez modifier n’importe quel marqueur directement dans l’**Historique de Session** :
- Survolez le marqueur et cliquez sur l’icône **crayon**.
- Modifiez le texte ou le timecode.
- Cliquez sur l’icône **coche** pour enregistrer ou sur **X** pour annuler.

### 4. Raccourcis Clavier
- Associez des actions à des touches de fonction spécifiques (`F1`, `F2`, … `F8`).
- En appuyant sur une touche configurée, le timecode actuel est immédiatement consigné avec la description associée.
- Pour configurer les raccourcis :
  1. Cliquez sur **Config** (icône d’engrenage dans la barre latérale).
  2. Assignez les touches de fonction aux libellés de notes souhaités.
  3. Cliquez sur **Save Configuration**.

## Exportation pour la Post‑Production
Une fois votre session terminée, téléchargez tous les marqueurs enregistrés dans des formats professionnels.
1. Choisissez le format souhaité : **CSV**, **XML** ou **SRT**.
   - **CSV** : génère des colonnes de tableur standards compatibles avec Adobe Premiere Pro et d’autres NLE.
   - **XML** : crée un document FCP XML pour l’import direct dans une timeline.
   - **SRT** : produit un fichier SubRip standard (ex. pour les sous‑titres ou revues VFX).
2. Cliquez sur **XML**.
3. Un fichier sera téléchargé en toute sécurité contenant vos marqueurs aux timecodes enregistrés.

## Gestion de la Session
- **Effacer les marqueurs** : cliquez sur **Clear** (icône corbeille) dans la barre latérale pour supprimer complètement l’historique de la session. Exportez d’abord si vous devez conserver les données.

---

## Arrêt du serveur (exécutable Windows)

Lorsque l'application s'exécute sous forme du fichier `min-markers.exe`, un bouton **Shutdown** apparaît dans l'interface (coin supérieur droit). Un clic ouvre une boîte de confirmation ; la validation envoie une requête `POST /api/shutdown` au serveur, qui s'arrête proprement après un bref délai. Cela permet de fermer l'application sans devoir terminer le processus console manuellement.

