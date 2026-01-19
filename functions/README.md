# Firebase Functions

## Installation

```bash
cd functions
npm install
```

## Développement local

```bash
npm run serve
```

## Déploiement

```bash
npm run deploy
```

Ou depuis la racine du projet :

```bash
firebase deploy --only functions
```

## Fonctions disponibles

### createTeamMember

Crée un compte utilisateur Firebase Auth et un document dans la collection `users`.

**Paramètres** :
- `email`: string (requis)
- `password`: string (requis, min 6 caractères)
- `first_name`: string (requis)
- `last_name`: string (requis)
- `phone`: string (optionnel)
- `role`: string (requis)
- `company_id`: string (requis)
- `agencies_id`: string (optionnel)
- `is_active`: boolean (requis)

**Retour** :
- `success`: boolean
- `userId`: string
- `message`: string
