-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: brgy360_db
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `admin_id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `announcements`
--

DROP TABLE IF EXISTS `announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `announcements` (
  `announcement_id` int NOT NULL AUTO_INCREMENT,
  `headline` varchar(200) NOT NULL,
  `category` varchar(50) NOT NULL,
  `target_audience` varchar(150) NOT NULL,
  `urgency` varchar(30) NOT NULL DEFAULT 'Standard',
  `feed_summary` text,
  `announcement_content` text NOT NULL,
  `publication_status` varchar(30) NOT NULL DEFAULT 'Unpublished',
  `published_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`announcement_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `budget_records`
--

DROP TABLE IF EXISTS `budget_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_records` (
  `budget_id` int NOT NULL AUTO_INCREMENT,
  `fiscal_year` year NOT NULL,
  `quarter` varchar(10) NOT NULL,
  `budget_category` varchar(100) NOT NULL,
  `allocated_budget` decimal(15,2) NOT NULL DEFAULT '0.00',
  `actual_spending` decimal(15,2) NOT NULL DEFAULT '0.00',
  `remaining_budget` decimal(15,2) GENERATED ALWAYS AS ((`allocated_budget` - `actual_spending`)) STORED,
  `utilization_rate` decimal(7,2) GENERATED ALWAYS AS ((case when (`allocated_budget` > 0) then ((`actual_spending` / `allocated_budget`) * 100) else 0 end)) STORED,
  `record_status` varchar(50) NOT NULL DEFAULT 'Planned',
  `budget_description` text NOT NULL,
  `remarks` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`budget_id`),
  CONSTRAINT `chk_actual_spending` CHECK ((`actual_spending` >= 0)),
  CONSTRAINT `chk_allocated_budget` CHECK ((`allocated_budget` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `concerns`
--

DROP TABLE IF EXISTS `concerns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `concerns` (
  `concern_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `reporter_name` varchar(150) DEFAULT NULL,
  `reporter_contact` varchar(30) DEFAULT NULL,
  `concern_title` varchar(150) NOT NULL,
  `category` varchar(100) NOT NULL,
  `date_submitted` date NOT NULL DEFAULT (curdate()),
  `urgency_level` varchar(30) NOT NULL,
  `sitio_area` varchar(100) NOT NULL,
  `exact_location` varchar(255) NOT NULL,
  `detailed_description` text NOT NULL,
  `photo_name` varchar(255) DEFAULT NULL,
  `photo_data` longtext,
  `concern_status` varchar(30) NOT NULL DEFAULT 'Pending',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolution_notes` text,
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`concern_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `concerns_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `recipient_type` enum('admin','resident') NOT NULL,
  `user_id` int DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `target_section` varchar(100) DEFAULT NULL,
  `target_record_id` varchar(100) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `idx_notifications_recipient` (`recipient_type`,`user_id`),
  KEY `idx_notifications_read` (`is_read`),
  KEY `idx_notifications_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_proposals`
--

DROP TABLE IF EXISTS `project_proposals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_proposals` (
  `proposal_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `project_title` varchar(200) NOT NULL,
  `sector_category` varchar(150) NOT NULL,
  `location_sitio` varchar(100) NOT NULL,
  `estimated_budget` decimal(12,2) NOT NULL,
  `proposed_target_timeline` varchar(150) NOT NULL,
  `rationale_community_impact` text NOT NULL,
  `guest_full_name` varchar(150) DEFAULT NULL,
  `guest_phone` varchar(30) DEFAULT NULL,
  `guest_email` varchar(255) DEFAULT NULL,
  `supporting_documents_path` text,
  `fiscal_year` year NOT NULL,
  `proposal_status` varchar(30) NOT NULL DEFAULT 'Pending',
  `council_review_notes` text,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`proposal_id`),
  KEY `fk_project_proposals_user` (`user_id`),
  CONSTRAINT `fk_project_proposals_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `project_id` int NOT NULL AUTO_INCREMENT,
  `project_title` varchar(200) NOT NULL,
  `location_purok` varchar(100) NOT NULL,
  `allocated_budget` decimal(12,2) NOT NULL,
  `initial_status` varchar(100) NOT NULL,
  `progress_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `project_scope` text NOT NULL,
  `target_beneficiaries` text NOT NULL,
  `project_status` varchar(30) NOT NULL DEFAULT 'Planning',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`),
  CONSTRAINT `chk_project_budget` CHECK ((`allocated_budget` >= 0)),
  CONSTRAINT `chk_project_progress` CHECK (((`progress_percentage` >= 0) and (`progress_percentage` <= 100)))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_requests`
--

DROP TABLE IF EXISTS `service_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_requests` (
  `request_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `document_type` varchar(100) NOT NULL,
  `purpose_category` varchar(150) NOT NULL,
  `specific_details` text NOT NULL,
  `supporting_document_path` varchar(500) DEFAULT NULL,
  `request_status` varchar(30) NOT NULL DEFAULT 'In Review',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `ready_for_pickup_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `service_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `full_legal_name` varchar(150) NOT NULL,
  `gender` varchar(30) NOT NULL,
  `civil_status` varchar(30) NOT NULL,
  `date_of_birth` date NOT NULL,
  `mobile_number` varchar(20) NOT NULL,
  `email` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `sitio_purok` varchar(100) NOT NULL,
  `id_type` varchar(100) DEFAULT NULL,
  `id_file_path` varchar(500) DEFAULT NULL,
  `residency_proof_type` varchar(150) NOT NULL DEFAULT 'No Proof of Residency',
  `residency_proof_path` varchar(500) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `verification_status` varchar(30) NOT NULL DEFAULT 'Pending',
  `verification_notes` text,
  `reviewed_at` datetime DEFAULT NULL,
  `id_card_number` varchar(100) DEFAULT NULL,
  `setup_token_hash` varchar(255) DEFAULT NULL,
  `setup_token_expires_at` datetime DEFAULT NULL,
  `password_set_at` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-09  8:47:23
