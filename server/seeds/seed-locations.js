require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hmwssb',
});

const data = [
  [1,'MMC','Malkajgiri',1,'1 \u2013 Keesara','1 - Keesara'],
  [2,'MMC','Malkajgiri',1,'1 \u2013 Keesara','2 - Chandrapuri Colony'],
  [3,'MMC','Malkajgiri',1,'1 \u2013 Keesara','3 - Jawahar Nagar'],
  [4,'MMC','Malkajgiri',1,'1 \u2013 Keesara','4 - Dammaiguda'],
  [5,'MMC','Malkajgiri',1,'1 \u2013 Keesara','189 - Yapral'],
  [6,'MMC','Malkajgiri',1,'1 \u2013 Keesara','300 - Shamirpet'],
  [7,'MMC','Malkajgiri',1,'2 \u2013 Alwal','190 - Turkapally'],
  [8,'MMC','Malkajgiri',1,'2 \u2013 Alwal','191 - Macha Bollaram'],
  [9,'MMC','Malkajgiri',1,'2 \u2013 Alwal','192 - Temple Alwal'],
  [10,'MMC','Malkajgiri',1,'2 \u2013 Alwal','193 - Venkatapuram'],
  [11,'MMC','Malkajgiri',1,'2 \u2013 Alwal','194 - Bhudevi Nagar'],
  [12,'MMC','Malkajgiri',1,'2 \u2013 Alwal','195 - Kanajiguda'],
  [13,'MMC','Malkajgiri',2,'3 - Bowenpally','196 - Monda Market'],
  [14,'MMC','Malkajgiri',2,'3 - Bowenpally','260 - Fateh Nagar'],
  [15,'MMC','Malkajgiri',2,'3 - Bowenpally','261 - Prakash Nagar'],
  [16,'MMC','Malkajgiri',2,'3 - Bowenpally','262 - Old Bowenpally'],
  [17,'MMC','Malkajgiri',2,'3 - Bowenpally','264 - Hasmathpet'],
  [18,'MMC','Malkajgiri',2,'4 - Moula Ali','184 - Balram Nagar'],
  [19,'MMC','Malkajgiri',2,'4 - Moula Ali','185 - Vinayak Nagar'],
  [20,'MMC','Malkajgiri',2,'4 - Moula Ali','186 - Moula Ali'],
  [21,'MMC','Malkajgiri',2,'4 - Moula Ali','187 - Kakatiya Nagar'],
  [22,'MMC','Malkajgiri',2,'4 - Moula Ali','188 - Neredmet'],
  [23,'MMC','Malkajgiri',2,'5 - Malkajgiri','180 - East Anandbagh'],
  [24,'MMC','Malkajgiri',2,'5 - Malkajgiri','181 - Mirjalguda'],
  [25,'MMC','Malkajgiri',2,'5 - Malkajgiri','182 - Goutham Nagar'],
  [26,'MMC','Malkajgiri',2,'5 - Malkajgiri','183 - Malkajgiri'],
  [27,'MMC','Uppal',3,'6 - Ghatkesar','5 - Nagaram'],
  [28,'MMC','Uppal',3,'6 - Ghatkesar','6 - Ghatkesar'],
  [29,'MMC','Uppal',3,'6 - Ghatkesar','7 - Edulabad'],
  [30,'MMC','Uppal',3,'6 - Ghatkesar','8 - Pocharam'],
  [31,'MMC','Uppal',3,'7 \u2013 Kapra','13 - Vampuguda'],
  [32,'MMC','Uppal',3,'7 \u2013 Kapra','14 - Kapra'],
  [33,'MMC','Uppal',3,'7 \u2013 Kapra','15 - Dr AS Rao Nagar'],
  [34,'MMC','Uppal',3,'7 \u2013 Kapra','16 - Kushaiguda'],
  [35,'MMC','Uppal',3,'7 \u2013 Kapra','17 - Cherlapally'],
  [36,'MMC','Uppal',4,'8 - Nacharam','18 - Shakthi Sai Nagar'],
  [37,'MMC','Uppal',4,'8 - Nacharam','19 - H.B. Colony'],
  [38,'MMC','Uppal',4,'8 - Nacharam','20 - Mallapur'],
  [39,'MMC','Uppal',4,'8 - Nacharam','21 - Nacharam'],
  [40,'MMC','Uppal',4,'8 - Nacharam','22 - HMT Nagar'],
  [41,'MMC','Uppal',4,'9 \u2013 Uppal','23 - Chilkanagar'],
  [42,'MMC','Uppal',4,'9 \u2013 Uppal','24 - Beerappagadda'],
  [43,'MMC','Uppal',4,'9 \u2013 Uppal','25 - Habsiguda'],
  [44,'MMC','Uppal',4,'9 \u2013 Uppal','26 - Ramanthapur'],
  [45,'MMC','Uppal',4,'9 \u2013 Uppal','27 - Venkat Reddy Nagar'],
  [46,'MMC','Uppal',4,'9 \u2013 Uppal','28 - Uppal'],
  [47,'MMC','Uppal',4,'10 - Boduppal','9 - Medipally'],
  [48,'MMC','Uppal',4,'10 - Boduppal','10 - Peerzadiguda'],
  [49,'MMC','Uppal',4,'10 - Boduppal','11 - Boduppal'],
  [50,'MMC','Uppal',4,'10 - Boduppal','12 - Chengicherla'],
  [51,'MMC','LB Nagar',5,'11 \u2013 Nagole','29 - Nagole'],
  [52,'MMC','LB Nagar',5,'11 \u2013 Nagole','45 - Mansoorabad'],
  [53,'MMC','LB Nagar',5,'11 \u2013 Nagole','46 - GSI'],
  [54,'MMC','LB Nagar',5,'11 \u2013 Nagole','47 - Lecturers Colony'],
  [55,'MMC','LB Nagar',5,'11 \u2013 Nagole','51 - Kuntloor'],
  [56,'MMC','LB Nagar',5,'11 \u2013 Nagole','52 - Pedda Amberpet'],
  [57,'MMC','LB Nagar',5,'12 - Saroornagar','30 - Kothapet'],
  [58,'MMC','LB Nagar',5,'12 - Saroornagar','31 - Chaitanyapuri'],
  [59,'MMC','LB Nagar',5,'12 - Saroornagar','32 - Gaddiannaram'],
  [60,'MMC','LB Nagar',5,'12 - Saroornagar','33 - Saroornagar'],
  [61,'MMC','LB Nagar',5,'12 - Saroornagar','34 - Doctors Colony'],
  [62,'MMC','LB Nagar',5,'12 - Saroornagar','35 - RK Puram'],
  [63,'MMC','LB Nagar',5,'12 - Saroornagar','36 - NTR Nagar'],
  [64,'MMC','LB Nagar',6,'13 - LB Nagar','37 - Lingojiguda'],
  [65,'MMC','LB Nagar',6,'13 - LB Nagar','38 - Champapet'],
  [66,'MMC','LB Nagar',6,'13 - LB Nagar','39 - Kharmanghat'],
  [67,'MMC','LB Nagar',6,'13 - LB Nagar','40 - Bairamalguda'],
  [68,'MMC','LB Nagar',6,'13 - LB Nagar','41 - Hastinapuram'],
  [69,'MMC','LB Nagar',6,'14 - Hayathnagar','42 - BN Reddy Nagar'],
  [70,'MMC','LB Nagar',6,'14 - Hayathnagar','43 - Vanasthalipuram'],
  [71,'MMC','LB Nagar',6,'14 - Hayathnagar','44 - Chintalkunta'],
  [72,'MMC','LB Nagar',6,'14 - Hayathnagar','48 - High Court Colony'],
  [73,'MMC','LB Nagar',6,'14 - Hayathnagar','49 - Sahebnagar'],
  [74,'MMC','LB Nagar',6,'14 - Hayathnagar','50 - Hayathnagar'],
  [75,'HMC','Shamshabad',7,'15 - Adibatla','53 - Thorrur'],
  [76,'HMC','Shamshabad',7,'15 - Adibatla','54 - Kongara Kalan'],
  [77,'HMC','Shamshabad',7,'15 - Adibatla','55 - Adibatla'],
  [78,'HMC','Shamshabad',7,'15 - Adibatla','56 - Turkayamjal'],
  [79,'HMC','Shamshabad',7,'16 - Badangpet','57 - Nadargul'],
  [80,'HMC','Shamshabad',7,'16 - Badangpet','58 - Prashanthi Hills'],
  [81,'HMC','Shamshabad',7,'16 - Badangpet','59 - Jillelaguda'],
  [82,'HMC','Shamshabad',7,'16 - Badangpet','60 - Meerpet'],
  [83,'HMC','Shamshabad',7,'16 - Badangpet','61 - Badangpet'],
  [84,'HMC','Shamshabad',7,'16 - Badangpet','62 - Balapur'],
  [85,'HMC','Shamshabad',8,'17 \u2013 Jalpally','63 - Shaheen Nagar'],
  [86,'HMC','Shamshabad',8,'17 \u2013 Jalpally','64 - Pahadi Shareef'],
  [87,'HMC','Shamshabad',8,'17 \u2013 Jalpally','65 - Jalpally'],
  [88,'HMC','Shamshabad',8,'18 - Shamshabad','66 - Thukkuguda'],
  [89,'HMC','Shamshabad',8,'18 - Shamshabad','67 - Mankhal'],
  [90,'HMC','Shamshabad',8,'18 - Shamshabad','118 - Shamshabad'],
  [91,'HMC','Shamshabad',8,'18 - Shamshabad','119 - Kothwalguda'],
  [92,'HMC','Rajendranagar',9,'19 - Rajendra Nagar','120 - Rajendra Nagar'],
  [93,'HMC','Rajendranagar',9,'19 - Rajendra Nagar','121 - Bandlaguda Jagir'],
  [94,'HMC','Rajendranagar',9,'19 - Rajendra Nagar','122 - Kismatpur'],
  [95,'HMC','Rajendranagar',9,'19 - Rajendra Nagar','123 - Hydershahkote'],
  [96,'HMC','Rajendranagar',9,'20 \u2013 Attapur','112 - Attapur'],
  [97,'HMC','Rajendranagar',9,'20 \u2013 Attapur','113 - Hyderguda'],
  [98,'HMC','Rajendranagar',9,'20 \u2013 Attapur','114 - Suleman Nagar'],
  [99,'HMC','Rajendranagar',9,'20 \u2013 Attapur','115 - Shastripuram'],
  [100,'HMC','Rajendranagar',9,'20 \u2013 Attapur','116 - Katedan'],
  [101,'HMC','Rajendranagar',9,'20 \u2013 Attapur','117 - Mailardevpally'],
  [102,'HMC','Rajendranagar',10,'21 - Bahadurpura','103 - Doodh Bowli'],
  [103,'HMC','Rajendranagar',10,'21 - Bahadurpura','108 - Teegal Kunta'],
  [104,'HMC','Rajendranagar',10,'21 - Bahadurpura','109 - Chandu Lal Baradari'],
  [105,'HMC','Rajendranagar',10,'21 - Bahadurpura','110 - Ramnasthpura'],
  [106,'HMC','Rajendranagar',10,'21 - Bahadurpura','111 - Kishanbagh'],
  [107,'HMC','Rajendranagar',10,'22 - Falaknuma','104 - Shah Ali Banda'],
  [108,'HMC','Rajendranagar',10,'22 - Falaknuma','105 - Falaknuma'],
  [109,'HMC','Rajendranagar',10,'22 - Falaknuma','106 - Jahanuma'],
  [110,'HMC','Rajendranagar',10,'22 - Falaknuma','107 - Nawab Saheb Kunta'],
  [111,'HMC','Rajendranagar',10,'23 - Chandrayangutta','68 - Bandlaguda'],
  [112,'HMC','Rajendranagar',10,'23 - Chandrayangutta','69 - Noori Nagar'],
  [113,'HMC','Rajendranagar',10,'23 - Chandrayangutta','70 - Barkas'],
  [114,'HMC','Rajendranagar',10,'23 - Chandrayangutta','71 - Kanchanbagh'],
  [115,'HMC','Rajendranagar',10,'23 - Chandrayangutta','72 - Chandrayangutta'],
  [116,'HMC','Rajendranagar',10,'24 - Jangammet','73 - Riyasat Nagar'],
  [117,'HMC','Rajendranagar',10,'24 - Jangammet','74 - Lalitha Bagh'],
  [118,'HMC','Rajendranagar',10,'24 - Jangammet','75 - Jangammet'],
  [119,'HMC','Rajendranagar',10,'24 - Jangammet','76 - Phool Bagh'],
  [120,'HMC','Rajendranagar',10,'24 - Jangammet','77 - Quadri Chaman'],
  [121,'HMC','Charminar',12,'25 - Santosh Nagar','84 - Bhanu Nagar'],
  [122,'HMC','Charminar',12,'25 - Santosh Nagar','85 - Santosh Nagar'],
  [123,'HMC','Charminar',12,'25 - Santosh Nagar','86 - IS SADAN'],
  [124,'HMC','Charminar',12,'25 - Santosh Nagar','87 - Saraswati Nagar'],
  [125,'HMC','Charminar',11,'26 - Yakutpura','78 - Gowlipura'],
  [126,'HMC','Charminar',11,'26 - Yakutpura','79 - Talab Chanchalam'],
  [127,'HMC','Charminar',11,'26 - Yakutpura','80 - Yakutpura'],
  [128,'HMC','Charminar',11,'26 - Yakutpura','81 - Dabeerpura'],
  [129,'HMC','Charminar',11,'26 - Yakutpura','82 - Rein Bazar'],
  [130,'HMC','Charminar',11,'26 - Yakutpura','83 - Madannapet'],
  [131,'HMC','Charminar',12,'27 - Malakpet','88 - Saidabad'],
  [132,'HMC','Charminar',12,'27 - Malakpet','89 - Asmangadh'],
  [133,'HMC','Charminar',12,'27 - Malakpet','93 - Akberbagh'],
  [134,'HMC','Charminar',12,'27 - Malakpet','94 - Chawani'],
  [135,'HMC','Charminar',11,'28 - Charminar','97 - Purani Haveli'],
  [136,'HMC','Charminar',11,'28 - Charminar','98 - Pathergatti'],
  [137,'HMC','Charminar',11,'28 - Charminar','99 - Hari Bowli'],
  [138,'HMC','Charminar',11,'28 - Charminar','100 - Qazipura'],
  [139,'HMC','Charminar',11,'28 - Charminar','101 - Ghansi Bazar'],
  [140,'HMC','Charminar',11,'28 - Charminar','102 - Purana Pul'],
  [141,'HMC','Charminar',12,'29 - Moosarambagh','90 - Moosarambagh'],
  [142,'HMC','Charminar',12,'29 - Moosarambagh','91 - Old Malakpet'],
  [143,'HMC','Charminar',12,'29 - Moosarambagh','92 - MCH Colony'],
  [144,'HMC','Charminar',12,'29 - Moosarambagh','95 - Kala Dera'],
  [145,'HMC','Charminar',12,'29 - Moosarambagh','96 - Azampura'],
  [146,'HMC','Golconda',13,'30 - Goshamahal','148 - Dattatreya Nagar'],
  [147,'HMC','Golconda',13,'30 - Goshamahal','149 - Manghalhat'],
  [148,'HMC','Golconda',13,'30 - Goshamahal','150 - Goshamahal'],
  [149,'HMC','Golconda',13,'30 - Goshamahal','151 - Begum Bazar'],
  [150,'HMC','Golconda',13,'30 - Goshamahal','152 - Jambagh'],
  [151,'HMC','Golconda',13,'30 - Goshamahal','153 - Exhibition Grounds'],
  [152,'HMC','Golconda',13,'31 \u2013 Karwan','134 - Langar Houz'],
  [153,'HMC','Golconda',13,'31 \u2013 Karwan','135 - Gudimalkapur'],
  [154,'HMC','Golconda',13,'31 \u2013 Karwan','136 - Karwan'],
  [155,'HMC','Golconda',13,'31 \u2013 Karwan','137 - Tappachabutra'],
  [156,'HMC','Golconda',13,'31 \u2013 Karwan','138 - Ziaguda'],
  [157,'HMC','Golconda',14,'32 - Golconda','129 - Nizam Colony'],
  [158,'HMC','Golconda',14,'32 - Golconda','130 - Nanalnagar'],
  [159,'HMC','Golconda',14,'32 - Golconda','131 - Tolichowki'],
  [160,'HMC','Golconda',14,'32 - Golconda','132 - Golconda'],
  [161,'HMC','Golconda',14,'32 - Golconda','133 - Ibrahimbagh'],
  [162,'HMC','Golconda',14,'32 - Golconda','223 - Shaikpet'],
  [163,'HMC','Golconda',14,'32 - Golconda','224 - OU Colony'],
  [164,'HMC','Golconda',14,'33 - Mehdipatnam','139 - Asif Nagar'],
  [165,'HMC','Golconda',14,'33 - Mehdipatnam','140 - Padmanabha Nagar'],
  [166,'HMC','Golconda',14,'33 - Mehdipatnam','141 - Mehdipatnam'],
  [167,'HMC','Golconda',14,'33 - Mehdipatnam','142 - Syed Nagar'],
  [168,'HMC','Golconda',14,'34 - Masab Tank','143 - Vijayanagar Colony'],
  [169,'HMC','Golconda',14,'34 - Masab Tank','144 - Ahmed Nagar'],
  [170,'HMC','Golconda',14,'34 - Masab Tank','145 - Shanti Nagar'],
  [171,'HMC','Golconda',14,'34 - Masab Tank','147 - Mallepally'],
  [172,'HMC','Khairatabad',15,'35 - Khairatabad','146 - Red Hills'],
  [173,'HMC','Khairatabad',15,'35 - Khairatabad','154 - Gunfoundry'],
  [174,'HMC','Khairatabad',15,'35 - Khairatabad','217 - Irrum Manzil'],
  [175,'HMC','Khairatabad',15,'35 - Khairatabad','218 - Somajiguda'],
  [176,'HMC','Khairatabad',15,'35 - Khairatabad','219 - Khairatabad'],
  [177,'HMC','Khairatabad',15,'35 - Khairatabad','220 - Himayathnagar'],
  [178,'HMC','Khairatabad',15,'36 - Jubilee Hills','215 - Jubilee Hills'],
  [179,'HMC','Khairatabad',15,'36 - Jubilee Hills','216 - Venkateshwara Colony'],
  [180,'HMC','Khairatabad',15,'36 - Jubilee Hills','221 - Banjara Hills'],
  [181,'HMC','Khairatabad',15,'36 - Jubilee Hills','222 - Film Nagar'],
  [182,'HMC','Khairatabad',16,'37 - Borabanda','210 - Krishna Nagar'],
  [183,'HMC','Khairatabad',16,'37 - Borabanda','211 - Rahamath Nagar'],
  [184,'HMC','Khairatabad',16,'37 - Borabanda','212 - Karmika Nagar'],
  [185,'HMC','Khairatabad',16,'37 - Borabanda','213 - Rajeev Nagar'],
  [186,'HMC','Khairatabad',16,'37 - Borabanda','214 - Borabanda'],
  [187,'HMC','Khairatabad',16,'38 - Yousufguda','205 - Erragadda'],
  [188,'HMC','Khairatabad',16,'38 - Yousufguda','206 - Vengal Rao Nagar'],
  [189,'HMC','Khairatabad',16,'38 - Yousufguda','207 - Srinagar Colony'],
  [190,'HMC','Khairatabad',16,'38 - Yousufguda','208 - Yousufguda'],
  [191,'HMC','Khairatabad',16,'38 - Yousufguda','209 - AG Colony'],
  [192,'HMC','Khairatabad',16,'39 - Ameerpet','200 - Begumpet'],
  [193,'HMC','Khairatabad',16,'39 - Ameerpet','201 - Ameerpet'],
  [194,'HMC','Khairatabad',16,'39 - Ameerpet','202 - SR Nagar'],
  [195,'HMC','Khairatabad',16,'39 - Ameerpet','203 - BK Guda'],
  [196,'HMC','Khairatabad',16,'39 - Ameerpet','204 - Sanathnagar'],
  [197,'HMC','Secunderabad',17,'40 - Kavadiguda','165 - Gandhi Nagar'],
  [198,'HMC','Secunderabad',17,'40 - Kavadiguda','166 - Kavadiguda'],
  [199,'HMC','Secunderabad',17,'40 - Kavadiguda','167 - Bakaram'],
  [200,'HMC','Secunderabad',17,'40 - Kavadiguda','168 - Bholakpur'],
  [201,'HMC','Secunderabad',17,'40 - Kavadiguda','197 - Padmarao Nagar'],
  [202,'HMC','Secunderabad',17,'40 - Kavadiguda','198 - Bansilalpet'],
  [203,'HMC','Secunderabad',17,'40 - Kavadiguda','199 - Ramgopalpet'],
  [204,'HMC','Secunderabad',17,'41 - Musheerabad','163 - Adikmet'],
  [205,'HMC','Secunderabad',17,'41 - Musheerabad','164 - Bagh Lingampally'],
  [206,'HMC','Secunderabad',17,'41 - Musheerabad','169 - Musheerabad'],
  [207,'HMC','Secunderabad',17,'41 - Musheerabad','170 - Ramnagar'],
  [208,'HMC','Secunderabad',17,'41 - Musheerabad','171 - Bapuji Nagar'],
  [209,'HMC','Secunderabad',17,'42 - Amberpet','155 - BARKATPURA'],
  [210,'HMC','Secunderabad',17,'42 - Amberpet','156 - Kachiguda'],
  [211,'HMC','Secunderabad',17,'42 - Amberpet','157 - Golnaka'],
  [212,'HMC','Secunderabad',17,'42 - Amberpet','158 - Patel Nagar'],
  [213,'HMC','Secunderabad',17,'42 - Amberpet','159 - Amberpet'],
  [214,'HMC','Secunderabad',17,'42 - Amberpet','160 - Bagh Amberpet'],
  [215,'HMC','Secunderabad',17,'42 - Amberpet','161 - Tilak Nagar'],
  [216,'HMC','Secunderabad',17,'42 - Amberpet','162 - Nallakunta'],
  [217,'HMC','Secunderabad',18,'43 - Tarnaka','172 - Boudha Nagar'],
  [218,'HMC','Secunderabad',18,'43 - Tarnaka','173 - Tarnaka'],
  [219,'HMC','Secunderabad',18,'43 - Tarnaka','174 - Seethaphalmandi'],
  [220,'HMC','Secunderabad',18,'43 - Tarnaka','175 - Chilkalguda'],
  [221,'HMC','Secunderabad',18,'44 - Mettuguda','176 - Mettuguda'],
  [222,'HMC','Secunderabad',18,'44 - Mettuguda','177 - Lalapet'],
  [223,'HMC','Secunderabad',18,'44 - Mettuguda','178 - North Lalaguda'],
  [224,'HMC','Secunderabad',18,'44 - Mettuguda','179 - Addagutta'],
  [225,'CMC','Serilingampally',20,'45 - Narsingi','124 - Narsingi'],
  [226,'CMC','Serilingampally',20,'45 - Narsingi','125 - Kokapet'],
  [227,'CMC','Serilingampally',20,'45 - Narsingi','126 - Gandipet'],
  [228,'CMC','Serilingampally',20,'45 - Narsingi','127 - Manikonda'],
  [229,'CMC','Serilingampally',20,'45 - Narsingi','128 - Neknampur'],
  [230,'CMC','Serilingampally',19,'46 - Patancheruvu','263 - Tellapur'],
  [231,'CMC','Serilingampally',19,'46 - Patancheruvu','265 - Muthangi'],
  [232,'CMC','Serilingampally',19,'46 - Patancheruvu','266 - Patancheruvu'],
  [233,'CMC','Serilingampally',19,'46 - Patancheruvu','267 - JP Colony'],
  [234,'CMC','Serilingampally',19,'47 - Ameenpur','268 - Ramachandrapuram (RC Puram)'],
  [235,'CMC','Serilingampally',19,'47 - Ameenpur','269 - Bharathi Nagar'],
  [236,'CMC','Serilingampally',19,'47 - Ameenpur','270 - Beeramguda'],
  [237,'CMC','Serilingampally',19,'47 - Ameenpur','271 - Ameenpur'],
  [238,'CMC','Serilingampally',19,'47 - Ameenpur','272 - Bollaram'],
  [239,'CMC','Serilingampally',20,'48 - Miyapur','236 - Hafeezpet'],
  [240,'CMC','Serilingampally',20,'48 - Miyapur','237 - Madeenaguda'],
  [241,'CMC','Serilingampally',20,'48 - Miyapur','238 - Chanda Nagar'],
  [242,'CMC','Serilingampally',20,'48 - Miyapur','239 - Deepthisri Nagar'],
  [243,'CMC','Serilingampally',20,'48 - Miyapur','240 - Miyapur'],
  [244,'CMC','Serilingampally',20,'48 - Miyapur','241 - Maktha Mahabubpet'],
  [245,'CMC','Serilingampally',20,'49 - Serilingampally','225 - Gachibowli'],
  [246,'CMC','Serilingampally',20,'49 - Serilingampally','226 - Nallagandla'],
  [247,'CMC','Serilingampally',20,'49 - Serilingampally','227 - Serilingampally'],
  [248,'CMC','Serilingampally',20,'49 - Serilingampally','228 - Masjid Banda'],
  [249,'CMC','Serilingampally',20,'49 - Serilingampally','229 - Sri Ram Nagar'],
  [250,'CMC','Serilingampally',20,'49 - Serilingampally','234 - Kondapur'],
  [251,'CMC','Kukatpally',21,'50 - Madhapur','230 - Anjaiah Nagar'],
  [252,'CMC','Kukatpally',21,'50 - Madhapur','231 - HITEC City'],
  [253,'CMC','Kukatpally',21,'50 - Madhapur','232 - Madhapur'],
  [254,'CMC','Kukatpally',21,'50 - Madhapur','233 - Izzath Nagar'],
  [255,'CMC','Kukatpally',21,'50 - Madhapur','235 - Matrusri Nagar'],
  [256,'CMC','Kukatpally',21,'50 - Madhapur','242 - Mayuri Nagar'],
  [257,'CMC','Kukatpally',21,'51 - Allwyn Colony','243 - Hyder Nagar'],
  [258,'CMC','Kukatpally',21,'51 - Allwyn Colony','244 - Bhagya Nagar Colony'],
  [259,'CMC','Kukatpally',21,'51 - Allwyn Colony','245 - Shamshiguda'],
  [260,'CMC','Kukatpally',21,'51 - Allwyn Colony','246 - Allwyn Colony'],
  [261,'CMC','Kukatpally',21,'51 - Allwyn Colony','247 - Vivekananda Nagar Colony'],
  [262,'CMC','Kukatpally',21,'51 - Allwyn Colony','248 - Venkateshwara Nagar'],
  [263,'CMC','Kukatpally',22,'52 - Kukatpally','249 - Kukatpally'],
  [264,'CMC','Kukatpally',22,'52 - Kukatpally','250 - Balaji Nagar'],
  [265,'CMC','Kukatpally',22,'52 - Kukatpally','251 - Vasanth Nagar'],
  [266,'CMC','Kukatpally',22,'52 - Kukatpally','252 - KPHB Colony'],
  [267,'CMC','Kukatpally',22,'52 - Kukatpally','253 - Kaithalapur'],
  [268,'CMC','Kukatpally',22,'52 - Kukatpally','254 - Gayatri Nagar'],
  [269,'CMC','Kukatpally',22,'53 - Moosapet','255 - Allapur'],
  [270,'CMC','Kukatpally',22,'53 - Moosapet','256 - Moti Nagar'],
  [271,'CMC','Kukatpally',22,'53 - Moosapet','257 - Moosapet'],
  [272,'CMC','Kukatpally',22,'53 - Moosapet','258 - Prashanth Nagar'],
  [273,'CMC','Kukatpally',22,'53 - Moosapet','259 - Balanagar'],
  [274,'CMC','Quthbullapur',23,'54 \u2013 Chintal','279 - Rodamestri Nagar'],
  [275,'CMC','Quthbullapur',23,'54 \u2013 Chintal','280 - Jagathgiri Gutta'],
  [276,'CMC','Quthbullapur',23,'54 \u2013 Chintal','281 - Ranga Reddy Nagar'],
  [277,'CMC','Quthbullapur',23,'54 \u2013 Chintal','282 - Chintal'],
  [278,'CMC','Quthbullapur',23,'54 \u2013 Chintal','283 - Giri Nagar'],
  [279,'CMC','Quthbullapur',23,'55 - Jeedimetla','284 - Ganesh Nagar'],
  [280,'CMC','Quthbullapur',23,'55 - Jeedimetla','285 - Padma Nagar'],
  [281,'CMC','Quthbullapur',23,'55 - Jeedimetla','286 - Quthbullapur'],
  [282,'CMC','Quthbullapur',23,'55 - Jeedimetla','287 - Pet Basheerabad'],
  [283,'CMC','Quthbullapur',23,'56 - Kompally','288 - Kompally'],
  [284,'CMC','Quthbullapur',23,'56 - Kompally','289 - Doolapally'],
  [285,'CMC','Quthbullapur',23,'56 - Kompally','290 - Subhash Nagar'],
  [286,'CMC','Quthbullapur',23,'56 - Kompally','292 - Saibaba Nagar'],
  [287,'CMC','Quthbullapur',23,'57 - Gajularamaram','277 - Mahadevpuram'],
  [288,'CMC','Quthbullapur',23,'57 - Gajularamaram','278 - Gajularamaram'],
  [289,'CMC','Quthbullapur',23,'57 - Gajularamaram','291 - Shapur Nagar'],
  [290,'CMC','Quthbullapur',23,'57 - Gajularamaram','293 - Suraram'],
  [291,'CMC','Quthbullapur',24,'58 - Nizampet','273 - Nizampet'],
  [292,'CMC','Quthbullapur',24,'58 - Nizampet','274 - Bachupally'],
  [293,'CMC','Quthbullapur',24,'58 - Nizampet','275 - Bhandari Layout'],
  [294,'CMC','Quthbullapur',24,'58 - Nizampet','276 - Pragathi Nagar'],
  [295,'CMC','Quthbullapur',24,'59 - Dundigal','294 - Bahadurpally'],
  [296,'CMC','Quthbullapur',24,'59 - Dundigal','295 - Bowrampet'],
  [297,'CMC','Quthbullapur',24,'59 - Dundigal','296 - Dundigal'],
  [298,'CMC','Quthbullapur',24,'60 - Medchal','297 - Medchal'],
  [299,'CMC','Quthbullapur',24,'60 - Medchal','298 - Pudur-Kistapur'],
  [300,'CMC','Quthbullapur',24,'60 - Medchal','299 - Gundlapochampally'],
];

async function seedLocations(dbPool) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing hierarchy (bottom-up to avoid FK violations)
    await client.query('UPDATE "Users" SET "RegionID"=NULL,"ZoneID"=NULL,"DivisionID"=NULL,"CircleID"=NULL,"WardID"=NULL');
    await client.query('UPDATE "EstimateHeader" SET "RegionID"=NULL,"ZoneID"=NULL,"DivisionID"=NULL,"CircleID"=NULL,"WardID"=NULL');
    await client.query('DELETE FROM "Wards"');
    await client.query('DELETE FROM "Circles"');
    await client.query('DELETE FROM "Divisions"');
    await client.query('DELETE FROM "Zones"');
    await client.query('DELETE FROM "Regions"');

    // Source hierarchy maps 1:1 to the schema:
    //   CORP              -> Region  (MMC, HMC, CMC)
    //   Zone Name         -> Zone
    //   DIVISION (1-24)   -> Division
    //   Circle No. & Name -> Circle
    //   Ward No. & Name   -> Ward
    const regionMap = {};     // CORP          -> RegionID
    const zoneMap = {};       // CORP|Zone     -> ZoneID
    const divisionMap = {};   // CORP|Zone|Div -> DivisionID
    const circleMap = {};     // CORP|Zone|Div|Circle -> CircleID

    let regionCount = 0, zoneCount = 0, divisionCount = 0, circleCount = 0, wardCount = 0;

    for (const row of data) {
      const [, corp, zoneName, divNum, circleName, wardName] = row;

      // Region = CORP
      if (!regionMap[corp]) {
        regionCount++;
        const r = await client.query('INSERT INTO "Regions" ("Name") VALUES ($1) RETURNING "RegionID"', [corp]);
        regionMap[corp] = r.rows[0].RegionID;
      }

      // Zone = Zone Name
      const zoneKey = corp + '|' + zoneName;
      if (!zoneMap[zoneKey]) {
        zoneCount++;
        const z = await client.query('INSERT INTO "Zones" ("RegionID","Name") VALUES ($1,$2) RETURNING "ZoneID"',
          [regionMap[corp], zoneName]);
        zoneMap[zoneKey] = z.rows[0].ZoneID;
      }

      // Division = DIVISION number (1-24)
      const divKey = zoneKey + '|' + divNum;
      if (!divisionMap[divKey]) {
        divisionCount++;
        const d = await client.query('INSERT INTO "Divisions" ("ZoneID","Name") VALUES ($1,$2) RETURNING "DivisionID"',
          [zoneMap[zoneKey], 'Division ' + divNum]);
        divisionMap[divKey] = d.rows[0].DivisionID;
      }

      // Circle = Circle No. & Name
      const circleKey = divKey + '|' + circleName;
      if (!circleMap[circleKey]) {
        circleCount++;
        const c = await client.query('INSERT INTO "Circles" ("DivisionID","Name") VALUES ($1,$2) RETURNING "CircleID"',
          [divisionMap[divKey], circleName]);
        circleMap[circleKey] = c.rows[0].CircleID;
      }

      // Ward = Ward No. & Name
      wardCount++;
      await client.query('INSERT INTO "Wards" ("CircleID","Name") VALUES ($1,$2)',
        [circleMap[circleKey], wardName]);
    }

    // Reset identity sequences so future app inserts never collide with seeded rows
    const idColumns = { Regions: 'RegionID', Zones: 'ZoneID', Divisions: 'DivisionID', Circles: 'CircleID', Wards: 'WardID' };
    for (const [t, idCol] of Object.entries(idColumns)) {
      await client.query(`SELECT setval(pg_get_serial_sequence('"${t}"', '${idCol}'), COALESCE(MAX("${idCol}"), 1)) FROM "${t}"`);
    }

    await client.query('COMMIT');
    console.log('Location hierarchy seeded correctly!');
    console.log('  Regions: ' + regionCount + ' (MMC, HMC, CMC)');
    console.log('  Zones: ' + zoneCount);
    console.log('  Divisions: ' + divisionCount + ' (Division 1-24)');
    console.log('  Circles: ' + circleCount + ' (Circle No. & Name)');
    console.log('  Wards: ' + wardCount + ' (Ward No. & Name)');

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedLocations(pool)
    .catch(e => { console.error('Error:', e.message); process.exit(1); })
    .finally(() => pool.end());
}

module.exports = { data, seedLocations };
