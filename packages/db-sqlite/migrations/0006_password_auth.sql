-- Cloud-mode email+password auth: add the bcrypt hash column to `users`.
-- Nullable so rows from other codepaths (desktop seed, prior Auth.js
-- Google inserts) don't need a value.

ALTER TABLE `users` ADD `password_hash` text;
