-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: producao
-- ------------------------------------------------------
-- Server version	8.0.42

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
-- Table structure for table `dados_hora_a_hora`
--

DROP TABLE IF EXISTS `dados_hora_a_hora`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dados_hora_a_hora` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_hora` varchar(45) DEFAULT NULL,
  `qtd_dados` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=98 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dados_hora_a_hora`
--

LOCK TABLES `dados_hora_a_hora` WRITE;
/*!40000 ALTER TABLE `dados_hora_a_hora` DISABLE KEYS */;
INSERT INTO `dados_hora_a_hora` VALUES (1,'01/05/2025 06:20:00',6),(2,'01/05/2025 07:25:00',6),(3,'01/05/2025 08:30:00',4),(4,'01/05/2025 09:35:00',6),(5,'01/05/2025 10:40:00',6),(6,'01/05/2025 11:45:00',8),(7,'01/05/2025 12:50:00',4),(8,'01/05/2025 13:55:00',2),(9,'01/05/2025 14:00:00',1),(10,'01/05/2025 15:05:00',3),(13,'05/05/2025 06:40:00',1),(14,'05/05/2025 07:25:00',1),(15,'05/05/2025 08:20:00',2),(16,'05/05/2025 09:55:00',1),(19,'06/05/2025 06:00:00',30),(20,'06/05/2025 07:00:00',7),(21,'06/05/2025 08:00:00',10),(22,'06/05/2025 09:00:00',8),(23,'06/05/2025 10:00:00',8),(24,'06/05/2025 10:00:00',1),(25,'06/05/2025 11:00:00',9),(26,'06/05/2025 15:00:00',5),(27,'06/05/2025 02:00:00',5),(28,'07/05/2025 11:00:00',6),(29,'08/05/2025 06:00:00',12),(30,'08/05/2025 07:00:00',5),(31,'08/05/2025 08:00:00',2),(32,'08/05/2025 09:00:00',4),(33,'08/05/2025 10:00:00',7),(34,'08/05/2025 11:00:00',7),(35,'09/05/2025 12:00:00',11),(36,'09/05/2025 13:00:00',6),(37,'09/05/2025 14:00:00',10),(38,'09/05/2025 15:00:00',10),(39,'09/05/2025 16:00:00',10),(40,'12/05/2025 08:00:00',4),(41,'12/05/2025 09:00:00',4),(42,'12/05/2025 10:00:00',9),(43,'12/05/2025 11:00:00',10),(44,'19/05/2025 06:00:00',11),(45,'19/05/2025 06:00:00',8),(46,'19/05/2025 07:00:00',8),(47,'19/05/2025 08:00:00',8),(48,'19/05/2025 09:00:00',5),(49,'19/05/2025 10:00:00',5),(50,'20/05/2025 07:00:00',10),(51,'20/05/2025 08:00:00',10),(52,'01/04/2025 06:00:00',4),(53,'01/04/2025 07:00:00',3),(59,'22/05/2025 06:00:00',4),(60,'22/05/2025 07:00:00',3),(63,'22/05/2025 08:00:00',5),(64,'22/05/2025 08:00:00',5),(65,'22/05/2025 09:00:00',6),(66,'22/05/2025 09:00:00',6),(67,'27/05/2025 06:00:00',8),(68,'27/05/2025 07:00:00',7),(69,'22/05/2025 06:00:00',7),(70,'22/05/2025 07:00:00',8),(71,'22/05/2025 10:00:00',8),(72,'22/05/2025 11:00:00',8),(73,'22/05/2025 13:10:00',12),(74,'22/05/2025 14:10:00',10),(75,'22/05/2025 10:11:00',8),(76,'22/05/2025 10:04:02',-8),(77,'23/05/2025 06:04:02',8),(78,'23/05/2025 07:04:02',7),(79,'23/05/2025 08:04:02',7),(80,'23/05/2025 09:04:02',9),(81,'23/05/2025 10:04:02',7),(82,'23/05/2025 11:04:02',7),(83,'23/05/2025 13:04:02',9),(84,'23/05/2025 06:22:00',1),(85,'23/05/2025 13:04:02',-1),(86,'26/05/2025 06:04:02',7),(87,'26/05/2025 07:04:02',6),(88,'26/05/2025 08:04:02',12),(89,'26/05/2025 09:04:02',12),(90,'26/05/2025 10:04:02',12),(91,'26/05/2025 11:04:02',6),(92,'26/05/2025 13:04:02',8),(93,'26/05/2025 14:04:02',14),(94,'26/05/2025 14:04:02',-3),(95,'21/05/2025 06:00:00',6),(96,'15/05/2025 06:00:00',8),(97,'15/05/2025 07:17:00',6);
/*!40000 ALTER TABLE `dados_hora_a_hora` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `eficiencia`
--

DROP TABLE IF EXISTS `eficiencia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `eficiencia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `qtd` int DEFAULT NULL,
  `flag` varchar(15) DEFAULT NULL,
  `data_hora` varchar(40) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `eficiencia`
--

LOCK TABLES `eficiencia` WRITE;
/*!40000 ALTER TABLE `eficiencia` DISABLE KEYS */;
INSERT INTO `eficiencia` VALUES (1,360,'produtiva','01/05/2025 00:00:00'),(2,0,'parada','01/05/2025 00:00:00'),(3,192,'rejeitada','01/05/2025 00:00:00'),(4,48,'produtiva','05/05/2025 00:00:00'),(5,0,'parada','05/05/2025 00:00:00'),(6,12,'rejeitada','05/05/2025 00:00:00'),(12,828,'produtiva','06/05/2025 11:00:00'),(13,2,'rejeitada','06/05/2025 11:00:00'),(14,2,'rejeitada','06/05/2025 11:00:00'),(15,1,'rejeitada','06/05/2025 13:00:00'),(16,0,'','07/05/2025 09:01:23'),(17,5,'','07/05/2025 10:00:00'),(18,1,'','07/05/2025 11:00:00'),(19,6,'','07/05/2025 13:00:00'),(20,2,'','07/05/2025 14:00:00'),(23,4,'rejeitada','08/05/2025 11:00:00'),(24,-4,'rejeitada','08/05/2025 11:00:00'),(25,4,'rejeitada','08/05/2025 11:00:00'),(26,80,'produtiva','08/05/2025 11:00:00'),(27,7,'rejeitada','08/05/2025 10:00:00'),(28,1,'rejeitada','08/05/2025 13:00:00'),(29,1,'rejeitada','08/05/2025 13:00:00'),(30,1,'rejeitada','08/05/2025 14:00:00'),(33,9,'rejeitada','12/05/2025 11:00:00'),(34,10,'rejeitada','19/05/2025 10:00:00'),(35,10,'rejeitada','19/05/2025 10:00:00'),(36,10,'rejeitada','19/05/2025 10:00:00'),(37,6,'rejeitada','19/05/2025 10:00:00'),(39,1,'rejeitada','22/05/2025 07:00:00'),(40,5,'rejeitada','22/05/2025 09:00:00'),(41,3,'rejeitada','22/05/2025 10:04:02'),(42,3,'rejeitada','22/05/2025 10:04:02'),(43,1,'rejeitada','26/05/2025 14:04:02'),(44,1,'rejeitada','26/05/2025 14:04:02'),(45,2,'rejeitada','15/05/2025 06:17:00'),(46,1,'rejeitada','15/05/2025 07:18:00');
/*!40000 ALTER TABLE `eficiencia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meta_dia`
--

DROP TABLE IF EXISTS `meta_dia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meta_dia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `meta` int DEFAULT NULL,
  `data_hora` varchar(40) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meta_dia`
--

LOCK TABLES `meta_dia` WRITE;
/*!40000 ALTER TABLE `meta_dia` DISABLE KEYS */;
INSERT INTO `meta_dia` VALUES (1,62,'01/05/2025'),(2,0,'01/05/2025'),(3,62,'05/05/2025'),(6,80,'06/05/2025'),(7,80,'08/05/2025'),(8,80,'09/05/2025'),(9,80,'12/05/2025'),(10,80,'19/05/2025'),(11,80,'20/05/2025'),(13,80,'22/05/2025'),(14,80,''),(15,80,''),(16,80,'23/05/2025'),(17,80,'26/05/2025'),(18,80,'27/05/2025'),(19,80,''),(20,80,'21/05/2025'),(21,80,''),(22,80,''),(23,80,''),(24,80,'2025-05-15'),(25,80,'2025-05-15'),(26,80,'15/05/2025');
/*!40000 ALTER TABLE `meta_dia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projetos`
--

DROP TABLE IF EXISTS `projetos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projetos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) DEFAULT NULL,
  `lider` varchar(255) DEFAULT NULL,
  `equipe_json` text,
  `etapa_atual` int DEFAULT '1',
  `data_inicio` date DEFAULT NULL,
  `data_fim` date DEFAULT NULL,
  `data_fim_etapa1` datetime DEFAULT NULL,
  `data_fim_etapa2` datetime DEFAULT NULL,
  `data_fim_etapa3` datetime DEFAULT NULL,
  `data_fim_etapa4` datetime DEFAULT NULL,
  `data_fim_etapa5` datetime DEFAULT NULL,
  `data_fim_etapa6` datetime DEFAULT NULL,
  `data_fim_etapa7` datetime DEFAULT NULL,
  `senha_edicao` varchar(100) DEFAULT NULL,
  `duracao_etapa1` int DEFAULT NULL COMMENT 'Duração planejada em dias para a etapa 1',
  `duracao_etapa2` int DEFAULT NULL COMMENT 'Duração planejada em dias para a etapa 2',
  `duracao_etapa3` int DEFAULT NULL COMMENT 'Duração planejada em dias para a etapa 3',
  `duracao_etapa4` int DEFAULT NULL COMMENT 'Duração planejada em dias para a etapa 4',
  `duracao_etapa5` int DEFAULT NULL COMMENT 'Duração planejada em dias para a etapa 5',
  `duracao_etapa6` int DEFAULT NULL COMMENT 'Duração planejada em dias para a etapa 6',
  `duracao_etapa7` int DEFAULT NULL COMMENT 'Duração planejada em dias para a etapa 7',
  `data_inicio_etapa1` datetime DEFAULT NULL COMMENT 'Data de início da etapa 1',
  `data_inicio_etapa2` datetime DEFAULT NULL COMMENT 'Data de início da etapa 2',
  `data_inicio_etapa3` datetime DEFAULT NULL COMMENT 'Data de início da etapa 3',
  `data_inicio_etapa4` datetime DEFAULT NULL COMMENT 'Data de início da etapa 4',
  `data_inicio_etapa5` datetime DEFAULT NULL COMMENT 'Data de início da etapa 5',
  `data_inicio_etapa6` datetime DEFAULT NULL COMMENT 'Data de início da etapa 6',
  `data_inicio_etapa7` datetime DEFAULT NULL COMMENT 'Data de início da etapa 7',
  `percentual_concluido` decimal(5,2) DEFAULT '0.00' COMMENT 'Percentual de conclusão do projeto',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projetos`
--

LOCK TABLES `projetos` WRITE;
/*!40000 ALTER TABLE `projetos` DISABLE KEYS */;
INSERT INTO `projetos` VALUES (1,'Projeto Alpha','Lucas Lima','[\"\\\"Maria\",\"João\",\"Carlos\\\"\"]',2,'2025-05-01','2025-05-29','2025-05-31 09:34:00','2025-05-28 12:00:00','2025-05-19 12:00:00','2025-05-27 20:00:00','2025-05-31 12:00:00','2025-06-03 12:00:00','2025-06-05 07:26:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-05-02 09:34:00','2025-05-11 12:00:00','2025-05-14 12:00:00','2025-05-20 15:22:00','2025-05-28 07:26:00','2025-06-01 07:26:00','2025-06-04 07:26:00',14.29),(12,'teste','nayra','[\"pedro\",\"emidio\",\"paulo\"]',1,'2025-05-20','2025-05-22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'123',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00);
/*!40000 ALTER TABLE `projetos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sub_etapas`
--

DROP TABLE IF EXISTS `sub_etapas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sub_etapas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `projeto_id` int NOT NULL,
  `etapa_principal` int NOT NULL,
  `descricao` varchar(255) NOT NULL,
  `concluida` tinyint(1) DEFAULT '0',
  `data_criacao` datetime DEFAULT CURRENT_TIMESTAMP,
  `data_conclusao` datetime DEFAULT NULL,
  `data_prevista_conclusao` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `projeto_id` (`projeto_id`),
  CONSTRAINT `sub_etapas_ibfk_1` FOREIGN KEY (`projeto_id`) REFERENCES `projetos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sub_etapas`
--

LOCK TABLES `sub_etapas` WRITE;
/*!40000 ALTER TABLE `sub_etapas` DISABLE KEYS */;
INSERT INTO `sub_etapas` VALUES (40,1,1,'comprar material',1,'2025-05-26 09:33:01','2025-05-26 09:36:31','2025-05-06'),(41,1,1,'ta',1,'2025-05-26 09:33:32','2025-05-27 10:09:00','2025-05-25'),(42,1,1,'t',0,'2025-05-26 10:40:05',NULL,'2025-05-27'),(43,1,2,'comprar material',1,'2025-05-26 13:08:09','2025-05-26 13:21:31','2025-05-25'),(44,1,2,'t',1,'2025-05-26 13:08:32','2025-05-26 13:21:47','2025-05-25'),(45,1,3,'ferramentaria',1,'2025-05-26 13:23:08','2025-05-26 13:23:34','2025-05-15'),(46,1,3,'torno 1',0,'2025-05-26 13:23:46',NULL,'2025-05-26'),(47,1,3,'torno 2',1,'2025-05-26 13:23:50','2025-05-26 13:24:45','2025-05-20'),(48,1,3,'torno 3',0,'2025-05-26 13:23:55',NULL,'2025-05-15'),(49,1,3,'freza 1',0,'2025-05-26 13:24:02',NULL,'2025-05-15'),(50,1,3,'freza 2',0,'2025-05-26 13:24:06',NULL,'2025-05-15'),(51,1,3,'freza 3',0,'2025-05-26 13:24:11',NULL,'2025-05-15');
/*!40000 ALTER TABLE `sub_etapas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `role` varchar(20) DEFAULT 'user',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'admin','admin123','Administrador','admin','2025-05-20 10:00:36'),(2,'diretoria_user','diretoria123','Diretoria User','diretoria','2025-05-26 13:52:32'),(3,'coordenador_user','coordenador123','Coordenador User','coordenador','2025-05-26 13:52:32'),(4,'lider_user','lider123','Líder User','lider','2025-05-26 13:52:32'),(5,'visualizador_user','visualizacao123','Visualizador User','visualizacao','2025-05-26 13:52:32');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-05-27 11:32:59
