ZASS
Système de Gestion des Présences Scolaires
Document Technique — Base de Données SQL
Version 1.0 — À destination du développeur Backend
Juin 2025
 1. Contexte du Projet
ZASS est une application mobile Flutter de gestion des présences scolaires avec alertes WhatsApp automatiques aux parents. Ce document décrit la structure complète de la base de données PostgreSQL à créer côté backend Node.js.

Stack technique
Backend : Node.js + Express
Base de données : PostgreSQL
Authentification : JWT
WhatsApp : whatsapp-web.js (QR Code)

2. Les Trois Rôles Utilisateurs

Rôle
Vision
Droits principaux
ADMIN
Globale — toute l'école
Créer classes, superviseurs, opérateurs. Voir tout.
SUPERVISOR
Locale — sa classe uniquement
Faire l'appel. Envoyer messages à sa classe.
OPERATOR
Limitée — saisie uniquement
Inscrire des élèves dans ses classes autorisées.

Règle fondamentale
Un compte ADMIN ne doit jamais être assigné comme superviseur d'une classe.
Si l'Admin doit faire l'appel, il se crée un second compte avec le rôle SUPERVISOR.

3. Schéma Complet des Tables
La base de données est composée de 6 tables et 4 index de performance.

Table
Rôle
Lien principal
users
Tous les comptes (Admin, Sup, Opérateur)
—
classes
Les classes de l'école
FK → users (supervisor_id)
operator_classes
Classes autorisées par Opérateur
FK → users + classes
students
Les élèves inscrits
FK → classes + users
attendance
Registre des présences / appels
FK → students + classes + users
message_history
Historique des messages WhatsApp
FK → students + users

4. Script SQL Complet (Corrigé et Définitif)
Ce script est prêt à être exécuté dans PostgreSQL. Il crée les 6 tables dans le bon ordre (respect des clés étrangères) et ajoute les index de performance.

4.1 Table users
Stocke tous les comptes : Admin, Superviseur et Opérateur. La colonne class_id permet au backend de charger automatiquement la classe du Superviseur ou de l'Opérateur à la connexion.

-- ================================================================
-- TABLE 1 : UTILISATEURS
-- ================================================================
CREATE TABLE users (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100)  NOT NULL,
    email        VARCHAR(150)  UNIQUE NOT NULL,
    password     VARCHAR(255)  NOT NULL,  -- Hash bcrypt
    role         VARCHAR(20)   NOT NULL
                 CHECK (role IN ('ADMIN', 'OPERATOR', 'SUPERVISOR')),
    class_id     INT           REFERENCES classes(id) ON DELETE SET NULL,
    -- NULL pour ADMIN, rempli pour SUPERVISOR et OPERATOR
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

Pourquoi class_id dans users ?
Quand le Superviseur se connecte, le backend lit son JWT, récupère son user.class_id
et charge automatiquement sa classe sans que Flutter n'ait besoin d'envoyer un paramètre.
Même logique pour l'Opérateur : le backend sait dans quelles classes il peut saisir.

4.2 Table classes
Chaque classe est liée à un superviseur unique. La contrainte UNIQUE sur supervisor_id empêche qu'un superviseur soit dans deux classes simultanément.

-- ================================================================
-- TABLE 2 : CLASSES
-- ================================================================
CREATE TABLE classes (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(50)  UNIQUE NOT NULL,
    supervisor_id  INT          UNIQUE REFERENCES users(id)
                                ON DELETE SET NULL,
    -- UNIQUE : 1 superviseur = 1 seule classe
    -- SET NULL : si le Sup est supprimé, la classe reste
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);


4.3 Table operator_classes — NOUVELLE
Table pivot qui définit les classes dans lesquelles un Opérateur de saisie est autorisé à inscrire des élèves. Sans cette table, impossible de gérer les droits granulaires des Opérateurs.

-- ================================================================
-- TABLE 3 : DROITS DES OPÉRATEURS (TABLE PIVOT)
-- ================================================================
CREATE TABLE operator_classes (
    operator_id  INT  REFERENCES users(id)   ON DELETE CASCADE,
    class_id     INT  REFERENCES classes(id) ON DELETE CASCADE,
    PRIMARY KEY (operator_id, class_id)
    -- CASCADE : si l'Opérateur ou la classe est supprimé(e),
    -- le droit disparaît automatiquement
);

Exemple d'utilisation
INSERT INTO operator_classes (operator_id, class_id) VALUES (5, 2), (5, 3);
→ L'Opérateur n°5 peut inscrire des élèves dans les classes 2 et 3 uniquement.
→ Le backend vérifie cette table avant chaque insertion d'élève par un Opérateur.

4.4 Table students
Stocke tous les élèves inscrits. Le statut permet de masquer les anciens élèves des listes d'appel sans les supprimer de la base. La colonne created_by trace quel Admin ou Opérateur a inscrit l'élève.

-- ================================================================
-- TABLE 4 : ÉLÈVES
-- ================================================================
CREATE TABLE students (
    id               SERIAL PRIMARY KEY,
    class_id         INT          REFERENCES classes(id)
                                  ON DELETE RESTRICT,
    -- RESTRICT : interdit de supprimer une classe avec des élèves
    first_name       VARCHAR(100) NOT NULL,
    last_name        VARCHAR(100) NOT NULL,
    birth_date       DATE         NOT NULL,
    parent_name      VARCHAR(150) NOT NULL,
    parent_whatsapp  VARCHAR(20)  NOT NULL,
    -- Format international obligatoire : +225XXXXXXXXXX
    status           VARCHAR(20)  DEFAULT 'ACTIVE'
                     CHECK (status IN (
                         'ACTIVE',
                         'TRANSFERRED',
                         'EXPELLED',
                         'GRADUATED',
                         'DROPOUT'
                     )),
    created_by       INT          REFERENCES users(id)
                                  ON DELETE SET NULL,
    -- Qui a inscrit cet élève (Admin ou Opérateur)
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

Règle critique : statut et liste d'appel
Seuls les élèves avec status = 'ACTIVE' apparaissent dans la liste d'appel.
Requête recommandée : SELECT * FROM students WHERE class_id = ? AND status = 'ACTIVE'
Les élèves TRANSFERRED, EXPELLED, GRADUATED, DROPOUT restent en base pour l'historique.

4.5 Table attendance
Le registre complet de tous les appels. La contrainte UNIQUE anti-doublon est fondamentale : elle empêche le backend d'enregistrer deux fois le même appel pour le même élève, la même période et la même matière le même jour.

-- ================================================================
-- TABLE 5 : PRÉSENCES (REGISTRE DES APPELS)
-- ================================================================
CREATE TABLE attendance (
    id            SERIAL PRIMARY KEY,
    student_id    INT          REFERENCES students(id) ON DELETE CASCADE,
    class_id      INT          REFERENCES classes(id)  ON DELETE CASCADE,
    submitted_by  INT          REFERENCES users(id)    ON DELETE SET NULL,
    -- Superviseur qui a validé l'appel
    status        VARCHAR(10)  NOT NULL
                  CHECK (status IN ('PRESENT', 'ABSENT')),
    period        VARCHAR(10)  NOT NULL
                  CHECK (period IN ('MATIN', 'MIDI', 'SOIR')),
    subject       VARCHAR(100) NOT NULL,
    -- Matière : Coran, Arabe, Français, Maths...
    date          DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    -- SÉCURITÉ ANTI-DOUBLON CRITIQUE
    -- Empêche de valider 2 fois le même appel par erreur
    CONSTRAINT unique_student_attendance_session
        UNIQUE (student_id, period, subject, date)
);

Flux Backend — POST /attendance/submit
1. Flutter envoie : { classId, period, subject, date, absents: [12, 27] }
2. Backend charge tous les élèves ACTIVE de la classe
3. INSERT dans attendance pour CHAQUE élève (PRESENT ou ABSENT)
4. Contrainte UNIQUE bloque automatiquement tout doublon
5. Backend filtre les absents → déclenche les messages WhatsApp

4.6 Table message_history
Historique complet de tous les messages WhatsApp envoyés — alertes d'absence automatiques et messages manuels. La colonne sent_by trace qui a déclenché chaque envoi.

-- ================================================================
-- TABLE 6 : HISTORIQUE MESSAGES WHATSAPP
-- ================================================================
CREATE TABLE message_history (
    id              SERIAL PRIMARY KEY,
    student_id      INT          NULL REFERENCES students(id)
                                 ON DELETE SET NULL,
    -- NULL pour les annonces générales non liées à un élève
    parent_whatsapp VARCHAR(20)  NOT NULL,
    message_text    TEXT         NOT NULL,
    message_type    VARCHAR(20)  DEFAULT 'ABSENCE'
                    CHECK (message_type IN (
                        'ABSENCE',
                        'PERSONNALISE',
                        'GROUPE_CLASSE',
                        'GROUPE_ECOLE'
                    )),
    status          VARCHAR(30)  NOT NULL
                    CHECK (status IN (
                        'SENT',
                        'PENDING',
                        'FAILED_INVALID_NUMBER',
                        'FAILED_SESSION_CLOSED'
                    )),
    sent_by         INT          REFERENCES users(id) ON DELETE SET NULL,
    -- Qui a déclenché cet envoi (Admin ou Superviseur)
    sent_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

4.7 Index de Performance
Ces index accélèrent les requêtes critiques de l'application, en particulier le chargement de la liste d'appel et les statistiques par élève.

-- ================================================================
-- INDEX DE PERFORMANCE
-- ================================================================

-- Accélère le chargement de la liste d'appel (filtre class_id + ACTIVE)
CREATE INDEX idx_students_class_status
    ON students(class_id, status);

-- Accélère l'affichage de l'historique du jour
CREATE INDEX idx_attendance_date
    ON attendance(date);

-- Accélère les statistiques mensuelles par élève
-- Ex : taux de présence de Ahmed sur janvier
CREATE INDEX idx_attendance_student
    ON attendance(student_id);

-- Accélère la lecture des erreurs d'envoi WhatsApp
CREATE INDEX idx_msg_status
    ON message_history(status);

5. Résumé 
#
Table modifiée
Correction
Raison
1
users
Ajout colonne class_id
Le backend doit connaître la classe du Sup/Opérateur à la connexion
2
students
Ajout colonne created_by
Audit : savoir quel Admin ou Opérateur a inscrit chaque élève
3
message_history
Ajout colonne sent_by
Audit : savoir qui a déclenché chaque envoi WhatsApp
4
operator_classes
Nouvelle table pivot
Gérer les classes autorisées par Opérateur sans partager les accès Admin

6. Ordre d'Exécution du Script
Les tables doivent être créées dans cet ordre précis pour respecter les dépendances des clés étrangères :

Ordre
Table
Dépend de
1
users
Aucune — première table à créer
2
classes
users (supervisor_id)
3
operator_classes
users + classes
4
students
classes + users (created_by)
5
attendance
students + classes + users
6
message_history
students + users (sent_by)
7
Index
Après toutes les tables

Note importante pour le backend
À cause de la dépendance circulaire entre users et classes (users.class_id → classes,
classes.supervisor_id → users), créer d'abord users SANS la contrainte FK class_id,
puis créer classes, puis ajouter la contrainte avec ALTER TABLE :

ALTER TABLE users ADD CONSTRAINT fk_user_class
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

7. Endpoints API Attendus par Flutter
Ces endpoints sont requis par l'application Flutter. Le backend doit les implémenter avec authentification JWT.

Auth
Méthode
Route
Description
POST
/auth/register
Créer le compte Admin (1 seul)
POST
/auth/login
Connexion — retourne JWT + rôle
POST
/auth/logout
Invalider le token

Classes
Méthode
Route
Description
GET
/classes
Liste toutes les classes (Admin)
POST
/classes
Créer une classe + compte Superviseur
DELETE
/classes/:id
Supprimer une classe (si aucun élève)

Élèves
Méthode
Route
Description
GET
/students?class_id=&status=
Liste élèves filtrés (Admin/Opérateur)
POST
/students
Inscrire un élève
PUT
/students/:id
Modifier un élève (statut, infos parent…)

Dashboard
Méthode
Route
Description
GET
/dashboard/admin
Stats globales (Admin)
GET
/dashboard/supervisor
Stats classe + statut appel du jour (Sup)

Présences (Appel)
Méthode
Route
Description
GET
/attendance/students
Élèves ACTIFS de la classe du Sup
POST
/attendance/submit
Valider l'appel → déclenche WhatsApp
GET
/attendance/history
Historique des appels (classe du Sup)

Messagerie
Méthode
Route
Description
POST
/messages/send
Envoyer message (parent / classe / école)
GET
/messages/history
Historique des messages envoyés

Sécurité Anti-Spam WhatsApp — Obligatoire
Lors du POST /attendance/submit, le backend doit insérer une pause entre chaque
Message WhatsApp pour éviter le blocage du numéro par WhatsApp :


Users → ajouter class_id —Pour savoir quelle classe charger quand le Sup se connecte
Students → ajouter created_by — pour savoir quel Admin ou Opérateur a inscrit chaque élève
Message_history → ajouter sent_by — pour tracer qui a déclenché chaque envoi WhatsApp
Operator_classes → table manquante — sans elle impossible de savoir dans quelles classes l'Opérateur peut saisir
