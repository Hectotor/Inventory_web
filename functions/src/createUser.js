const admin = require("firebase-admin");
const functions = require("firebase-functions");

// Initialiser Firebase Admin (doit être fait une seule fois)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Crée un utilisateur avec un compte Firebase Auth et un document dans Firestore
 * @param {Object} userData - Données de l'utilisateur
 * @param {string} userData.email - Email de l'utilisateur
 * @param {string} userData.password - Mot de passe (min 6 caractères)
 * @param {string} userData.first_name - Prénom
 * @param {string} userData.last_name - Nom
 * @param {string} userData.company_id - ID de l'entreprise
 * @param {string} [userData.phone] - Téléphone (optionnel)
 * @param {string} [userData.role] - Rôle (admin, area manager, warehouse, sales, driver, customer)
 * @param {string} [userData.agencies_id] - ID de l'agence (optionnel)
 * @param {boolean} [userData.is_active=true] - Statut actif/inactif
 * @param {string} [userData.street_address] - Adresse (optionnel, pour les clients)
 * @param {string} [userData.postal_code] - Code postal (optionnel, pour les clients)
 * @param {string} [userData.country] - Pays (optionnel, pour les clients)
 * @returns {Promise<Object>} - { userId, email, success: true }
 */
async function createUser(userData) {
  try {
    // Validation des champs requis
    if (!userData.email || !userData.password || !userData.first_name || 
        !userData.last_name || !userData.company_id) {
      throw new Error("Les champs email, password, first_name, last_name et company_id sont requis");
    }

    if (userData.password.length < 6) {
      throw new Error("Le mot de passe doit contenir au moins 6 caractères");
    }

    // Créer le compte Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: userData.email,
      password: userData.password,
      displayName: `${userData.first_name} ${userData.last_name}`,
      emailVerified: false,
    });

    console.log(`✅ Compte Firebase Auth créé: ${userRecord.uid}`);

    // Créer le document dans Firestore
    const userDoc = {
      company_id: userData.company_id,
      first_name: userData.first_name,
      last_name: userData.last_name,
      email: userData.email,
      phone: userData.phone || null,
      role: userData.role || "sales",
      is_active: userData.is_active !== undefined ? userData.is_active : true,
      agencies_id: userData.agencies_id || null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Ajouter les champs d'adresse uniquement pour les clients
    if (userData.role === "customer") {
      if (userData.street_address) {
        userDoc.street_address = userData.street_address;
      }
      if (userData.postal_code) {
        userDoc.postal_code = userData.postal_code;
      }
      if (userData.country) {
        userDoc.country = userData.country;
      }
    }

    await admin.firestore().collection("users").doc(userRecord.uid).set(userDoc);

    console.log(`✅ Document Firestore créé pour: ${userRecord.uid}`);

    return {
      success: true,
      userId: userRecord.uid,
      email: userRecord.email,
      message: "Utilisateur créé avec succès",
    };
  } catch (error) {
    console.error("❌ Erreur lors de la création de l'utilisateur:", error.message);
    
    // Si on a créé le compte Auth mais pas le document Firestore, supprimer le compte
    if (error.message && !error.message.includes("auth/")) {
      try {
        const userRecord = await admin.auth().getUserByEmail(userData.email);
        await admin.auth().deleteUser(userRecord.uid);
        console.log(`🧹 Compte Auth supprimé après erreur: ${userRecord.uid}`);
      } catch (deleteError) {
        // Ignorer les erreurs de suppression
      }
    }

    throw error;
  }
}

/**
 * Crée un utilisateur depuis la ligne de commande
 * Usage: node createUser.js email password first_name last_name company_id [phone] [role] [agencies_id] [is_active]
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 5) {
    console.error(`
Usage: node createUser.js <email> <password> <first_name> <last_name> <company_id> [phone] [role] [agencies_id] [is_active]

Exemple:
  node createUser.js john@example.com password123 John Doe company123 +33123456789 sales agency123 true
    `);
    process.exit(1);
  }

  const [email, password, first_name, last_name, company_id, phone, role, agencies_id, is_active] = args;

  createUser({
    email,
    password,
    first_name,
    last_name,
    company_id,
    phone: phone || null,
    role: role || "sales",
    agencies_id: agencies_id || null,
    is_active: is_active === "false" ? false : true,
  })
    .then((result) => {
      console.log("\n✅ Succès:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Erreur:", error.message);
      process.exit(1);
    });
}

/**
 * Cloud Function pour créer un membre d'équipe
 * Vérifie les permissions et appelle createUser
 */
const createTeamMember = functions
  .region("europe-west1")
  .runWith({ memory: "256MB" })
  .https.onCall(async (data, context) => {
  // Vérifier que l'utilisateur est authentifié
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "L'utilisateur doit être authentifié"
    );
  }

  // Vérifier que l'utilisateur appartient à la même entreprise
  const callerUser = await admin
    .firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();

  if (!callerUser.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Utilisateur non trouvé"
    );
  }

  const callerData = callerUser.data();
  if (callerData?.company_id !== data.company_id) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Vous ne pouvez créer des utilisateurs que pour votre entreprise"
    );
  }

  try {
    // Utiliser la fonction createUser pour créer l'utilisateur
    const result = await createUser({
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      role: data.role,
      company_id: data.company_id,
      agencies_id: data.agencies_id,
      is_active: data.is_active,
    });

    return {
      success: result.success,
      userId: result.userId,
      message: result.message,
    };
  } catch (error) {
    // Gérer les erreurs spécifiques
    if (error.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError(
        "already-exists",
        "Cet email est déjà utilisé"
      );
    }

    throw new functions.https.HttpsError(
      "internal",
      `Erreur lors de la création: ${error.message}`
    );
  }
});

module.exports = { createUser, createTeamMember };
