-- Retire the Performance Checker feature. Indexes go implicitly with the
-- table in SQLite.

DROP TABLE IF EXISTS `perf_sessions`;
