/**
 * The demo seed's data: the 10 research centers, 8 demo accounts in two labs, and 100 demo assets. All invented or about institutions; nothing about real people.
 * Layer: database tooling. Read by prisma/seed.ts. Imports the server's POOL_CUSTODIAN_ID constant and Prisma's enum types.
 * Used by: npm run seed.
 */
import type { assets_category, research_centers_location, roles_role_name, users_user_type } from "@prisma/client";
import { POOL_CUSTODIAN_ID } from "../server/shared/constants/poolCustodian";

/** One research center. Its short code is also the prefix of its asset tags, which is how the app tells labs apart today. */
export interface DemoLab {
  name: string;
  shortCode: string;
  location: research_centers_location;
}

/** The 10 research centers, from docs/reference/AdRIC_DB_Schema.sql. Names of institutions, not of people. */
export const DEMO_LABS: DemoLab[] = [
  { name: "Center for ICT for Development (CITE4D)", shortCode: "CITe4D", location: "MANILA" },
  { name: "Center for Automation Research (CAR)", shortCode: "CAR", location: "LAGUNA" },
  { name: "Center for Human-Computer Innovations (CeHCI)", shortCode: "CeHCI", location: "MANILA" },
  { name: "Human-X Interactions Lab", shortCode: "HXIL", location: "LAGUNA" },
  { name: "Graphics, Animation, Multimedia and Entertainment Laboratory (GAME Lab)", shortCode: "GAME", location: "MANILA" },
  { name: "Center for Language Technologies (CeLT)", shortCode: "CeLT", location: "MANILA" },
  { name: "Bioinformatics Lab", shortCode: "Bio", location: "MANILA" },
  { name: "Center for Networking and Information Security (CNIS)", shortCode: "CNIS", location: "MANILA" },
  { name: "Computational Imaging and Visual Innovations (CIVI)", shortCode: "CIVI", location: "MANILA" },
  { name: "Technology, Education, Entertainment, Empathy, Design (TE3D) House", shortCode: "TE3D", location: "LAGUNA" },
];

/** One demo account. Every name is invented; the password is not here (SEED_PASSWORD, set when seeding). */
export interface DemoAccount {
  userId: number;
  lastName: string;
  email: string;
  role: roles_role_name;
  userType: users_user_type;
  /** Short code of the lab the account is linked to through user_centers, or null for none. */
  lab: string | null;
}

/**
 * Demo accounts across two labs, CITe4D and CAR, so "Lab Heads see only their own lab" (issue #94) can be tried.
 * The Admin must be user POOL_CUSTODIAN_ID: the server reads that user as "nobody holds it" and checks at startup that it exists.
 * Addresses are @dlsu.edu.ph because the login page accepts no other domain.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { userId: POOL_CUSTODIAN_ID, lastName: "Admin", email: "demo.admin@dlsu.edu.ph", role: "ADMIN", userType: "STAFF", lab: null },
  { userId: 2, lastName: "Director", email: "demo.director@dlsu.edu.ph", role: "ADRIC_DIRECTOR", userType: "FACULTY", lab: null },
  { userId: 3, lastName: "TSG Staff", email: "demo.tsg@dlsu.edu.ph", role: "TSG_STAFF", userType: "STAFF", lab: null },
  { userId: 4, lastName: "Lab Head CITe4D", email: "demo.labhead.cite4d@dlsu.edu.ph", role: "LAB_HEAD", userType: "FACULTY", lab: "CITe4D" },
  { userId: 5, lastName: "Lab Head CAR", email: "demo.labhead.car@dlsu.edu.ph", role: "LAB_HEAD", userType: "FACULTY", lab: "CAR" },
  { userId: 6, lastName: "Custodian A", email: "demo.custodian.a@dlsu.edu.ph", role: "CUSTODIAN", userType: "STUDENT", lab: "CITe4D" },
  { userId: 7, lastName: "Custodian B", email: "demo.custodian.b@dlsu.edu.ph", role: "CUSTODIAN", userType: "STUDENT", lab: "CITe4D" },
  { userId: 8, lastName: "Custodian C", email: "demo.custodian.c@dlsu.edu.ph", role: "CUSTODIAN", userType: "STUDENT", lab: "CAR" },
];

/** One demo asset: tag, name, serial number, manufacturer, category, procurement date, warranty end, funding source, value. */
export type DemoAsset = [string, string, string, string, assets_category, string, string, string, number];

/**
 * The 100 demo assets of docs/reference/AdRIC_DB_Schema.sql, 10 per lab: product names, invented serial numbers,
 * funding agencies. Their lab is the tag's prefix.
 */
export const DEMO_ASSETS: DemoAsset[] = [
  ["CITe4D-0001", "ASUS TUF Gaming A15", "SN-TUFN1G401", "ASUS", "DEV_KIT", "2025-08-10", "2027-08-10", "DOST-SEI", 49999],
  ["CITe4D-0002", "Dell UltraSharp 27\" Monitor", "SN-DELLU27X", "Dell", "MONITOR", "2025-08-10", "2028-08-10", "DOST-SEI", 18500],
  ["CITe4D-0003", "Logitech MX Master 3S", "SN-LGMX3S22", "Logitech", "MOUSE", "2025-09-01", "2026-09-01", "CHED", 5499],
  ["CITe4D-0004", "Meta Quest 3", "SN-MQ3-0091", "Meta", "VR", "2026-01-15", "2027-01-15", "DOST-PCIEERD", 35000],
  ["CITe4D-0005", "Canon EOS 90D", "SN-CN90D-77", "Canon", "CAMERA", "2025-07-20", "2027-07-20", "CHED", 89999],
  ["CITe4D-0006", "Raspberry Pi 5 Kit", "SN-RPI5-0036", "Raspberry Pi Foundation", "DEV_KIT", "2026-03-01", "2028-03-01", "DOST-SEI", 3499],
  ["CITe4D-0007", "Logitech C920 Webcam", "SN-LGC920-046", "Logitech", "CAMERA", "2025-11-05", "2027-11-05", "DOST-SEI", 6999],
  ["CITe4D-0008", "Samsung T7 Portable SSD 1TB", "SN-SMT7SSD-047", "Samsung", "HARD_DRIVE", "2025-11-05", "2028-11-05", "CHED", 8999],
  ["CITe4D-0009", "Apple Magic Keyboard", "SN-APLMK-048", "Apple", "KEYBOARD", "2025-12-01", "2027-12-01", "DOST-SEI", 9999],
  ["CITe4D-0010", "Anker PowerConf S500 Speakerphone", "SN-ANKPC-049", "Anker", "AUDIO", "2025-12-01", "2027-12-01", "CHED", 12999],
  ["CAR-0001", "Robotics Arm Simulator Kit", "SN-RASK-104", "Universal Robots", "SIMULATOR", "2025-05-12", "2027-05-12", "DOST-SEI", 65000],
  ["CAR-0002", "Intel NUC 13 Mini PC", "SN-NUC13-882", "Intel", "CPU", "2025-09-18", "2028-09-18", "DOST-SEI", 39999],
  ["CAR-0003", "Cisco Catalyst 24-Port Switch", "SN-CISC24-19", "Cisco", "SWITCH", "2025-04-02", "2028-04-02", "CHED", 22000],
  ["CAR-0004", "TP-Link Archer AX55 Router", "SN-TPAX55-03", "TP-Link", "ROUTER", "2025-11-01", "2027-11-01", "DOST-SEI", 4999],
  ["CAR-0005", "SanDisk Extreme Pro 256GB", "SN-SDXP256-6", "SanDisk", "MEMORY_CARD", "2026-01-20", "2027-01-20", "CHED", 2599],
  ["CAR-0006", "KUKA LBR iiwa Collaborative Arm", "SN-KUKAIIWA-1", "KUKA", "SIMULATOR", "2026-02-14", "2029-02-14", "DOST-PCIEERD", 899999],
  ["CAR-0007", "Universal Robots UR5e Arm", "SN-URUR5E-050", "Universal Robots", "SIMULATOR", "2026-01-08", "2029-01-08", "DOST-PCIEERD", 1299999],
  ["CAR-0008", "Raspberry Pi Compute Module Kit", "SN-RPICM-051", "Raspberry Pi Foundation", "DEV_KIT", "2026-01-08", "2028-01-08", "DOST-SEI", 8999],
  ["CAR-0009", "FLIR C5 Thermal Camera", "SN-FLIRC5-052", "FLIR", "CAMERA", "2026-01-20", "2028-01-20", "CHED", 45999],
  ["CAR-0010", "D-Link 16-Port Gigabit Switch", "SN-DLK16P-053", "D-Link", "SWITCH", "2026-01-20", "2029-01-20", "DOST-SEI", 9999],
  ["CeHCI-0001", "iPad Pro 12.9\"", "SN-IPADP-441", "Apple", "TABLET", "2025-07-08", "2027-07-08", "DOST-SEI", 74999],
  ["CeHCI-0002", "Logitech MX Keys", "SN-MXKEYS-12", "Logitech", "KEYBOARD", "2025-08-22", "2026-08-22", "CHED", 6999],
  ["CeHCI-0003", "Focusrite Scarlett 2i2", "SN-FSCAR-289", "Focusrite", "AUDIO", "2025-06-30", "2027-06-30", "DOST-SEI", 12999],
  ["CeHCI-0004", "Zoom H6 Audio Recorder", "SN-ZH6-554", "Zoom", "RECORDER", "2025-10-14", "2027-10-14", "DOST-SEI", 18999],
  ["CeHCI-0005", "LG UltraFine 24\" Monitor", "SN-LGUF24-71", "LG", "MONITOR", "2025-09-05", "2028-09-05", "CHED", 15999],
  ["CeHCI-0006", "Wacom Cintiq Pro 24", "SN-WACCP24-6", "Wacom", "TABLET", "2026-01-22", "2028-01-22", "CHED", 89999],
  ["CeHCI-0007", "Tobii Eye Tracker 5", "SN-TOBET5-054", "Tobii", "CAMERA", "2025-10-14", "2027-10-14", "DOST-PCIEERD", 89999],
  ["CeHCI-0008", "Elgato Stream Deck+", "SN-ELGSD-055", "Elgato", "DEV_KIT", "2025-10-14", "2027-10-14", "CHED", 12999],
  ["CeHCI-0009", "Shure SM7B Microphone", "SN-SHRSM7B-056", "Shure", "AUDIO", "2025-11-02", "2027-11-02", "DOST-SEI", 24999],
  ["CeHCI-0010", "Sony WH-1000XM5 Headphones", "SN-SNYWH5-057", "Sony", "AUDIO", "2025-11-02", "2027-11-02", "CHED", 22999],
  ["HXIL-0001", "Sony FX3 Cinema Camera", "SN-SFX3-908", "Sony", "VIDEO_CAMERA", "2026-02-01", "2028-02-01", "DOST-PCIEERD", 249999],
  ["HXIL-0002", "Samsung 55\" QLED TV", "SN-SMQL55-31", "Samsung", "TV", "2025-12-10", "2028-12-10", "CHED", 54999],
  ["HXIL-0003", "JBL EON615 Powered Speaker", "SN-JBLE615-8", "JBL", "SPEAKER", "2025-05-25", "2027-05-25", "DOST-SEI", 32999],
  ["HXIL-0004", "BenQ TK850 4K Projector", "SN-BQTK850-4", "BenQ", "PROJECTOR", "2025-03-19", "2027-03-19", "DOST-SEI", 89999],
  ["HXIL-0005", "WD My Book 8TB", "SN-WDMB8T-55", "Western Digital", "HARD_DRIVE", "2025-11-27", "2028-11-27", "CHED", 11999],
  ["HXIL-0006", "GoPro Hero 12 Black", "SN-GPH12BK-9", "GoPro", "VIDEO_CAMERA", "2026-02-05", "2028-02-05", "DOST-SEI", 24999],
  ["HXIL-0007", "DJI Osmo Pocket 3", "SN-DJIOP3-058", "DJI", "VIDEO_CAMERA", "2026-01-12", "2028-01-12", "DOST-PCIEERD", 89999],
  ["HXIL-0008", "Rode Wireless GO II", "SN-RDWGO2-059", "Rode", "AUDIO", "2026-01-12", "2028-01-12", "DOST-SEI", 14999],
  ["HXIL-0009", "Anker 27\" 4K Monitor", "SN-ANK27K-060", "Anker", "MONITOR", "2026-01-25", "2029-01-25", "CHED", 24999],
  ["HXIL-0010", "Zoom PodTrak P4 Recorder", "SN-ZMPTP4-061", "Zoom", "RECORDER", "2026-01-25", "2028-01-25", "DOST-SEI", 18999],
  ["GAME-0001", "Steam Deck OLED", "SN-STDKOL-19", "Valve", "DEV_KIT", "2026-01-05", "2027-01-05", "DOST-SEI", 32999],
  ["GAME-0002", "Custom Gaming PC (RTX 4070)", "SN-GPCRTX-70", "Custom Build", "CPU", "2025-10-30", "2028-10-30", "DOST-SEI", 89999],
  ["GAME-0003", "ASUS ROG Swift 27\" Monitor", "SN-ROGSW27-2", "ASUS", "MONITOR", "2025-10-30", "2028-10-30", "CHED", 24999],
  ["GAME-0004", "Logitech StreamCam", "SN-LGSCAM-45", "Logitech", "CAMERA", "2025-08-14", "2026-08-14", "DOST-SEI", 5999],
  ["GAME-0005", "Razer BlackWidow V4 Keyboard", "SN-RZBWV4-16", "Razer", "KEYBOARD", "2025-08-14", "2026-08-14", "DOST-SEI", 8999],
  ["GAME-0006", "PlayStation 5 Dev Kit", "SN-PS5DK-014", "Sony", "DEV_KIT", "2026-01-30", "2028-01-30", "DOST-PCIEERD", 42999],
  ["GAME-0007", "Xbox Series X Dev Console", "SN-XBXSX-062", "Microsoft", "DEV_KIT", "2025-09-14", "2027-09-14", "DOST-SEI", 34999],
  ["GAME-0008", "SteelSeries Arctis Nova Pro Headset", "SN-SSANP-063", "SteelSeries", "AUDIO", "2025-09-14", "2027-09-14", "CHED", 22999],
  ["GAME-0009", "Elgato Game Capture HD60X", "SN-ELGHD60-064", "Elgato", "RECORDER", "2025-09-28", "2027-09-28", "DOST-SEI", 8999],
  ["GAME-0010", "LG UltraGear 27\" Monitor", "SN-LGUG27-065", "LG", "MONITOR", "2025-09-28", "2028-09-28", "CHED", 21999],
  ["CeLT-0001", "Samsung Galaxy Tab S9", "SN-SGTS9-233", "Samsung", "TABLET", "2025-07-16", "2027-07-16", "CHED", 44999],
  ["CeLT-0002", "HP LaserJet Pro M404dn", "SN-HPLJ404-9", "HP", "PRINTER", "2025-06-01", "2027-06-01", "DOST-SEI", 15999],
  ["CeLT-0003", "Tascam DR-40X Recorder", "SN-TSDR40X-3", "Tascam", "RECORDER", "2025-09-09", "2027-09-09", "DOST-SEI", 9999],
  ["CeLT-0004", "Bose Companion 2 Speakers", "SN-BSCMP2-61", "Bose", "SPEAKER", "2025-04-28", "2027-04-28", "CHED", 4999],
  ["CeLT-0005", "Netgear 8-Port Switch", "SN-NG8PSW-27", "Netgear", "SWITCH", "2025-12-02", "2028-12-02", "DOST-SEI", 6999],
  ["CeLT-0006", "Epson EB-2250U Projector", "SN-EPEB2250-3", "Epson", "PROJECTOR", "2026-02-19", "2028-02-19", "CHED", 74999],
  ["CeLT-0007", "Yamaha PJP-20UR Speaker System", "SN-YMPJP-066", "Yamaha", "SPEAKER", "2025-08-19", "2027-08-19", "DOST-SEI", 9999],
  ["CeLT-0008", "Brother HL-L2350DW Printer", "SN-BRHL23-067", "Brother", "PRINTER", "2025-08-19", "2027-08-19", "CHED", 7999],
  ["CeLT-0009", "Sony ICD-UX570 Recorder", "SN-SNICD-068", "Sony", "RECORDER", "2025-09-02", "2027-09-02", "DOST-SEI", 6999],
  ["CeLT-0010", "TP-Link Deco Mesh Router", "SN-TPDECO-069", "TP-Link", "ROUTER", "2025-09-02", "2027-09-02", "CHED", 5999],
  ["Bio-0001", "Nikon D7500 Microscope Camera", "SN-NKD7500-8", "Nikon", "CAMERA", "2025-05-19", "2027-05-19", "CHED", 69999],
  ["Bio-0002", "Lexar 128GB microSD", "SN-LX128SD-4", "Lexar", "MEMORY_CARD", "2026-01-08", "2027-01-08", "DOST-SEI", 1299],
  ["Bio-0003", "Seagate Expansion 4TB", "SN-SGEX4T-52", "Seagate", "HARD_DRIVE", "2025-10-11", "2028-10-11", "DOST-SEI", 6499],
  ["Bio-0004", "Microsoft Ergonomic Mouse", "SN-MSERGO-18", "Microsoft", "MOUSE", "2025-08-25", "2026-08-25", "CHED", 1999],
  ["Bio-0005", "Dell P2422H 24\" Monitor", "SN-DLP2422-7", "Dell", "MONITOR", "2025-08-25", "2028-08-25", "CHED", 9999],
  ["Bio-0006", "Olympus BX43 Microscope Camera Unit", "SN-OLBX43-27", "Olympus", "CAMERA", "2026-01-15", "2028-01-15", "DOST-SEI", 129999],
  ["Bio-0007", "Zeiss Axiocam Microscope Camera", "SN-ZSAXC-070", "Zeiss", "CAMERA", "2025-07-28", "2027-07-28", "DOST-PCIEERD", 99999],
  ["Bio-0008", "WD Elements 5TB HDD", "SN-WDEL5T-071", "Western Digital", "HARD_DRIVE", "2025-07-28", "2028-07-28", "DOST-SEI", 6999],
  ["Bio-0009", "SanDisk 1TB microSD", "SN-SDMSD1T-072", "SanDisk", "MEMORY_CARD", "2025-08-11", "2026-08-11", "CHED", 1999],
  ["Bio-0010", "Logitech K380 Keyboard", "SN-LGK380-073", "Logitech", "KEYBOARD", "2025-08-11", "2027-08-11", "DOST-SEI", 2999],
  ["CNIS-0001", "Fortinet FortiGate 60F Firewall", "SN-FGT60F-441", "Fortinet", "ROUTER", "2026-02-01", "2029-02-01", "DOST-PCIEERD", 54999],
  ["CNIS-0002", "Ubiquiti UniFi Dream Machine", "SN-UBIQDM-074", "Ubiquiti", "ROUTER", "2026-02-03", "2029-02-03", "DOST-PCIEERD", 24999],
  ["CNIS-0003", "Cisco Catalyst 9200 Switch", "SN-CSC9200-075", "Cisco", "SWITCH", "2026-02-03", "2029-02-03", "DOST-PCIEERD", 189999],
  ["CNIS-0004", "Dell PowerEdge Mini Server", "SN-DLPE-076", "Dell", "CPU", "2026-02-17", "2029-02-17", "CHED", 149999],
  ["CNIS-0005", "Penetration Testing Laptop Kit", "SN-PTLK-077", "Custom Build", "DEV_KIT", "2026-02-17", "2028-02-17", "DOST-SEI", 79999],
  ["CNIS-0006", "Network Traffic Capture Appliance", "SN-NTCA-078", "Custom Build", "DEV_KIT", "2026-03-03", "2028-03-03", "DOST-SEI", 64999],
  ["CNIS-0007", "Netgear ProSafe 24-Port Switch", "SN-NGPS24-079", "Netgear", "SWITCH", "2026-03-03", "2029-03-03", "CHED", 21999],
  ["CNIS-0008", "Samsung 1TB Encrypted SSD", "SN-SM1TSSD-080", "Samsung", "HARD_DRIVE", "2026-03-10", "2028-03-10", "DOST-SEI", 8999],
  ["CNIS-0009", "Logitech Brio Webcam", "SN-LGBRIO-081", "Logitech", "CAMERA", "2026-03-10", "2028-03-10", "CHED", 6999],
  ["CNIS-0010", "Dell 24\" Monitor", "SN-DL24MN-082", "Dell", "MONITOR", "2026-03-17", "2029-03-17", "DOST-SEI", 11999],
  ["CIVI-0001", "Intel RealSense D455 Depth Camera", "SN-IRSD455-88", "Intel", "CAMERA", "2026-01-27", "2028-01-27", "CHED", 18999],
  ["CIVI-0002", "NVIDIA Jetson Orin Nano", "SN-NVJON-083", "NVIDIA", "DEV_KIT", "2026-01-06", "2028-01-06", "DOST-PCIEERD", 24999],
  ["CIVI-0003", "Intel RealSense L515 LiDAR Camera", "SN-IRSL515-084", "Intel", "CAMERA", "2026-01-06", "2028-01-06", "DOST-PCIEERD", 39999],
  ["CIVI-0004", "ASUS ROG Strix RTX 4080 PC", "SN-ASRTX80-085", "ASUS", "CPU", "2026-01-19", "2029-01-19", "CHED", 129999],
  ["CIVI-0005", "Wacom Intuos Pro", "SN-WACIP-086", "Wacom", "TABLET", "2026-01-19", "2028-01-19", "DOST-SEI", 34999],
  ["CIVI-0006", "BenQ PD3220U Monitor", "SN-BQPD32-087", "BenQ", "MONITOR", "2026-02-02", "2029-02-02", "DOST-PCIEERD", 74999],
  ["CIVI-0007", "Canon EOS R5", "SN-CNR5-088", "Canon", "CAMERA", "2026-02-02", "2028-02-02", "CHED", 189999],
  ["CIVI-0008", "Samsung 2TB SSD", "SN-SM2TSSD-089", "Samsung", "HARD_DRIVE", "2026-02-16", "2028-02-16", "DOST-SEI", 9999],
  ["CIVI-0009", "Logitech G502 Mouse", "SN-LGG502-090", "Logitech", "MOUSE", "2026-02-16", "2027-02-16", "CHED", 4999],
  ["CIVI-0010", "Dell 27\" 4K Monitor", "SN-DL27K4-091", "Dell", "MONITOR", "2026-03-01", "2029-03-01", "DOST-SEI", 44999],
  ["TE3D-0001", "Meta Quest Pro", "SN-MQPRO-0053", "Meta", "VR", "2026-02-10", "2028-02-10", "DOST-SEI", 62999],
  ["TE3D-0002", "Meta Quest 3S", "SN-MQ3S-092", "Meta", "VR", "2026-01-14", "2028-01-14", "DOST-SEI", 26999],
  ["TE3D-0003", "HTC Vive Pro 2", "SN-HTCVP2-093", "HTC", "VR", "2026-01-14", "2028-01-14", "DOST-PCIEERD", 79999],
  ["TE3D-0004", "Logitech StreamCam", "SN-LGSTCM-094", "Logitech", "CAMERA", "2026-01-28", "2027-01-28", "CHED", 5999],
  ["TE3D-0005", "Yamaha HS5 Studio Monitor Speakers", "SN-YMHS5-095", "Yamaha", "SPEAKER", "2026-01-28", "2028-01-28", "DOST-SEI", 18999],
  ["TE3D-0006", "Epson PowerLite Projector", "SN-EPPWL-096", "Epson", "PROJECTOR", "2026-02-11", "2028-02-11", "CHED", 64999],
  ["TE3D-0007", "Zoom H4n Recorder", "SN-ZMH4N-097", "Zoom", "RECORDER", "2026-02-11", "2028-02-11", "DOST-SEI", 8999],
  ["TE3D-0008", "Samsung 55\" TV", "SN-SM55TV-098", "Samsung", "TV", "2026-02-25", "2029-02-25", "DOST-PCIEERD", 44999],
  ["TE3D-0009", "Netgear Nighthawk Router", "SN-NGNHWK-099", "Netgear", "ROUTER", "2026-02-25", "2028-02-25", "CHED", 8999],
  ["TE3D-0010", "SanDisk Extreme 512GB microSD", "SN-SDEX512-100", "SanDisk", "MEMORY_CARD", "2026-03-05", "2027-03-05", "DOST-SEI", 1999],
];
