import sys
import subprocess

def main():
    print("🚀 Déploiement de la release MIN_BOOKMARKS")
    version_type = "patch"
    
    if len(sys.argv) > 1:
        version_type = sys.argv[1]
        
    if version_type not in ["patch", "minor", "major"]:
        print("Erreur: L'argument doit être 'patch', 'minor', ou 'major'")
        print("Exemple d'utilisation: python deploy.py patch")
        sys.exit(1)
        
    print(f"📦 Création d'une nouvelle release de type '{version_type}'...")
    
    try:
        # Exécute npm version qui s'occupe de tout : 
        # bump version, màj documentation, git add, git commit, git tag, et git push
        subprocess.run(["npm", "version", version_type], check=True, shell=True)
        print("\n✅ Déploiement Git terminé !")
        print("Le workflow GitHub Actions est en cours et va compiler votre exécutable.")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Une erreur est survenue lors du déploiement : {e}")

if __name__ == "__main__":
    main()
