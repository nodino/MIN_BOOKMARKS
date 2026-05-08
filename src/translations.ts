export type Language = 'en' | 'fr';

export const translations = {
  en: {
    nav: {
      config: "Config",
      free: "Free",
      clear: "Clear",
      export: "Export"
    },
    header: {
      freeRun: "Free Run",
      status: {
        linked: "Linked",
        offline: "Offline",
        record: "RECORD",
        running: "RUNNING",
        ready: "READY",
        stopped: "STOPPED"
      }
    },
    main: {
      currentTime: "Current Time",
      logColor: "Log Color",
      placeholder: "Comment... (Enter to log)",
      instantActions: "Instant Actions"
    },
    session: {
      title: "Session History",
      noMarkers: "No Markers Logged"
    },
    export: {
      download: "Download for Premiere"
    },
    config: {
      title: "Shortcut Config",
      save: "Save Configuration",
      noteLabel: "Note"
    }
    // Unused TriCaster‑related keys have been removed.
  },
  fr: {
    nav: {
      config: "Config",
      free: "Libre",
      clear: "Effacer",
      export: "Exporter"
    },
    header: {
      freeRun: "Temps Libre",
      status: {
        linked: "Connecté",
        offline: "Hors ligne",
        record: "ENREGISTRE",
        running: "EN COURS",
        ready: "PRÊT",
        stopped: "ARRÊTÉ"
      }
    },
    main: {
      currentTime: "Temps Actuel",
      logColor: "Couleur Log",
      placeholder: "Commentaire... (Entrée pour log)",
      instantActions: "Actions Rapides"
    },
    session: {
      title: "Historique Session",
      noMarkers: "Aucun marqueur enregistré"
    },
    export: {
      download: "Télécharger pour Premiere"
    },
    config: {
      title: "Config Raccourcis",
      save: "Sauvegarder Configuration",
      noteLabel: "Note"
    }
    // Unused TriCaster‑related keys have been removed.
  }
};
